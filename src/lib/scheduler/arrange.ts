import type { Arrangement, PomodoroOptions, Rounding, Slot, SlotType, Track } from "@/lib/types";

/** 구간 길이와 곡 길이 합의 허용 오차(초) */
export const TOLERANCE_SEC = 60;

interface SlotPlan {
  type: SlotType;
  session: number;
  targetSec: number;
}

/** 집중1, (휴식1), 집중2, … 집중N 순서로 구간 목록을 만든다. 마지막 세션 뒤 휴식은 없다. */
function buildSlotPlans(options: PomodoroOptions): SlotPlan[] {
  const plans: SlotPlan[] = [];
  for (let session = 1; session <= options.sessions; session++) {
    plans.push({ type: "focus", session, targetSec: options.focusSec });
    if (session < options.sessions) {
      plans.push({ type: "break", session, targetSec: options.breakSec });
    }
  }
  return plans;
}

/**
 * 후보 합계 중 하나를 고른다.
 * 허용 오차 안: 정확 일치 > 지정 방향 > 반대 방향, 그다음 |오차|가 작은 쪽, 그다음 비용이 낮은 쪽.
 * 허용 오차 안에 없으면 지정 방향에서 가장 가까운 합계, 없으면 반대 방향에서 가장 가까운 합계.
 */
function pickSum(
  target: number,
  rounding: Rounding,
  reachable: (sum: number) => boolean,
  costOf: (sum: number) => number,
  maxSum: number,
): number | null {
  const sideOf = (sum: number) => (sum === target ? 0 : (sum > target) === (rounding === "up") ? 1 : 2);

  let best: { sum: number; key: number[] } | null = null;
  const lo = Math.max(1, target - TOLERANCE_SEC);
  const hi = Math.min(maxSum, target + TOLERANCE_SEC);
  for (let sum = lo; sum <= hi; sum++) {
    if (!reachable(sum)) continue;
    const key = [sideOf(sum), Math.abs(sum - target), costOf(sum)];
    if (!best || compareKeys(key, best.key) < 0) best = { sum, key };
  }
  if (best) return best.sum;

  // 허용 오차 안에 조합이 없을 때: 지정 방향 우선으로 가장 가까운 합계
  for (const preferred of [1, 2]) {
    for (let sum = 1; sum <= maxSum; sum++) {
      if (!reachable(sum) || sideOf(sum) !== preferred) continue;
      const key = [Math.abs(sum - target), costOf(sum)];
      if (!best || compareKeys(key, best.key) < 0) best = { sum, key };
    }
    if (best) return best.sum;
  }
  return null;
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * 한 구간에 들어갈 곡 조합을 부분집합 합 DP로 찾는다.
 * 비용 = (이미 쓴 곡이면 큰 값) + 원래 인덱스. 중복을 먼저 줄이고, 그다음 원래 순서에 가깝게 고른다.
 */
function chooseTracks(
  pool: Track[],
  usedIds: Set<string>,
  target: number,
  rounding: Rounding,
): Track[] {
  const n = pool.length;
  const reuseCost = n * n + 1;
  const maxDuration = pool.reduce((max, track) => Math.max(max, track.durationSec), 0);
  const maxSum = target + Math.max(maxDuration, TOLERANCE_SEC);
  const width = maxSum + 1;

  const cost = new Float64Array(width).fill(Infinity);
  cost[0] = 0;
  // take[i * width + s] === 1 이면 i번째 곡을 처리하며 합계 s의 최적해가 갱신됐다는 뜻
  const take = new Uint8Array(n * width);

  for (let i = 0; i < n; i++) {
    const duration = pool[i].durationSec;
    const itemCost = (usedIds.has(pool[i].id) ? reuseCost : 0) + i;
    for (let sum = maxSum; sum >= duration; sum--) {
      const candidate = cost[sum - duration] + itemCost;
      if (candidate < cost[sum]) {
        cost[sum] = candidate;
        take[i * width + sum] = 1;
      }
    }
  }

  const chosenSum = pickSum(
    target,
    rounding,
    (sum) => cost[sum] !== Infinity,
    (sum) => cost[sum],
    maxSum,
  );
  if (chosenSum === null) return [];

  const chosen: Track[] = [];
  let remaining = chosenSum;
  for (let i = n - 1; i >= 0 && remaining > 0; i--) {
    if (take[i * width + remaining] === 1) {
      chosen.push(pool[i]);
      remaining -= pool[i].durationSec;
    }
  }
  return chosen.reverse(); // 원래 플레이리스트 순서 유지
}

function describeDeviation(deviationSec: number): string {
  const abs = Math.abs(deviationSec);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const text = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
  return `목표 시간보다 ${text} ${deviationSec > 0 ? "길어요" : "짧아요"}`;
}

/**
 * 플레이리스트를 사용자 옵션에 맞춰 집중/휴식 구간별로 재배열한다.
 * 순수 함수이며 입력을 변경하지 않는다.
 */
export function arrangePlaylist(tracks: Track[], options: PomodoroOptions): Arrangement {
  const plans = buildSlotPlans(options);

  // 집중/휴식 중 더 긴 시간보다 긴 곡은 제외
  const maxSec = Math.max(options.focusSec, options.breakSec);
  const usable = tracks.filter((track) => track.durationSec > 0 && track.durationSec <= maxSec);
  const removed = tracks.filter((track) => !usable.includes(track));

  const usedIds = new Set<string>();
  const playCounts = new Map<string, number>();

  const slots: Slot[] = plans.map((plan) => {
    const needsMusic = plan.type === "focus" || options.playBreak;
    if (!needsMusic) {
      return { ...plan, tracks: [], totalSec: 0, deviationSec: 0 };
    }
    if (usable.length === 0) {
      return {
        ...plan,
        tracks: [],
        totalSec: 0,
        deviationSec: -plan.targetSec,
        warning: "재생할 수 있는 곡이 없어요",
      };
    }

    const chosen = chooseTracks(usable, usedIds, plan.targetSec, options.rounding);
    for (const track of chosen) {
      usedIds.add(track.id);
      playCounts.set(track.id, (playCounts.get(track.id) ?? 0) + 1);
    }
    // 모든 곡을 한 번씩 썼다면 새 사이클 시작
    if (usedIds.size >= usable.length) usedIds.clear();

    const totalSec = chosen.reduce((sum, track) => sum + track.durationSec, 0);
    const deviationSec = totalSec - plan.targetSec;
    const slot: Slot = { ...plan, tracks: chosen, totalSec, deviationSec };
    if (Math.abs(deviationSec) > TOLERANCE_SEC) slot.warning = describeDeviation(deviationSec);
    return slot;
  });

  let repeatedTrackCount = 0;
  for (const count of playCounts.values()) repeatedTrackCount += Math.max(0, count - 1);

  return { slots, removed, repeatedTrackCount };
}
