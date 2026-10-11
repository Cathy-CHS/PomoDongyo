import { describe, expect, it } from "vitest";
import type { PomodoroOptions, Track } from "@/lib/types";
import { arrangePlaylist, TOLERANCE_SEC } from "./arrange";

const track = (id: string, durationSec: number): Track => ({ id, title: id, durationSec });

const baseOptions: PomodoroOptions = {
  focusSec: 600,
  breakSec: 300,
  sessions: 1,
  playBreak: false,
  rounding: "up",
};

describe("arrangePlaylist", () => {
  it("합이 정확히 일치하는 조합을 고른다", () => {
    const tracks = [track("a", 300), track("b", 240), track("c", 300)];
    const { slots } = arrangePlaylist(tracks, baseOptions);
    expect(slots[0].totalSec).toBe(600);
    expect(slots[0].deviationSec).toBe(0);
    expect(slots[0].warning).toBeUndefined();
  });

  it("올림이면 목표 이상, 내림이면 목표 이하 조합을 고른다 (오차 이내)", () => {
    // 5+4+2=11분(660초) vs 5+4=9분(540초): 둘 다 ±60초 이내가 아니므로 3곡 조합을 따로 둔다
    const tracks = [track("a", 300), track("b", 270), track("c", 60)]; // 630, 570, 330, ...
    const up = arrangePlaylist(tracks, { ...baseOptions, rounding: "up" });
    const down = arrangePlaylist(tracks, { ...baseOptions, rounding: "down" });
    expect(up.slots[0].totalSec).toBe(630);
    expect(down.slots[0].totalSec).toBe(570);
  });

  it("허용 오차 안에 조합이 없으면 경고와 함께 지정 방향 최근접 조합을 쓴다", () => {
    const tracks = [track("a", 420), track("b", 420)]; // 420, 840 / 목표 600
    const up = arrangePlaylist(tracks, { ...baseOptions, focusSec: 600, rounding: "up" });
    const down = arrangePlaylist(tracks, { ...baseOptions, focusSec: 600, rounding: "down" });
    expect(up.slots[0].totalSec).toBe(840);
    expect(up.slots[0].warning).toBeDefined();
    expect(down.slots[0].totalSec).toBe(420);
    expect(down.slots[0].warning).toBeDefined();
  });

  it("집중/휴식 중 더 긴 시간보다 긴 곡은 제거한다", () => {
    const tracks = [track("short", 300), track("long", 601)];
    const { removed, slots } = arrangePlaylist(tracks, baseOptions);
    expect(removed.map((t) => t.id)).toEqual(["long"]);
    expect(slots[0].tracks.map((t) => t.id)).not.toContain("long");
  });

  it("휴식 음악이 꺼져 있으면 휴식 구간에는 곡을 배정하지 않는다", () => {
    const tracks = [track("a", 300), track("b", 300), track("c", 300)];
    const { slots } = arrangePlaylist(tracks, { ...baseOptions, sessions: 2, playBreak: false });
    expect(slots.map((s) => s.type)).toEqual(["focus", "break", "focus"]);
    expect(slots[1].tracks).toEqual([]);
    expect(slots[1].warning).toBeUndefined();
  });

  it("휴식 음악이 켜져 있으면 휴식 구간 길이에 맞게 따로 배정한다", () => {
    const tracks = [track("a", 300), track("b", 300), track("c", 300), track("d", 300), track("e", 300)];
    const { slots } = arrangePlaylist(tracks, { ...baseOptions, sessions: 2, playBreak: true });
    expect(slots[0].totalSec).toBe(600);
    expect(slots[1].totalSec).toBe(300);
    expect(slots[2].totalSec).toBe(600);
  });

  it("마지막 세션 뒤에는 휴식 구간이 없다", () => {
    const { slots } = arrangePlaylist([track("a", 600)], { ...baseOptions, sessions: 3 });
    expect(slots.map((s) => s.type)).toEqual(["focus", "break", "focus", "break", "focus"]);
  });

  it("곡이 충분하면 중복 없이 한 번씩만 쓴다", () => {
    const tracks = Array.from({ length: 6 }, (_, i) => track(`t${i}`, 300));
    const { slots, repeatedTrackCount } = arrangePlaylist(tracks, { ...baseOptions, sessions: 3 });
    const ids = slots.flatMap((s) => s.tracks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(repeatedTrackCount).toBe(0);
  });

  it("곡이 부족하면 소진 후에만 다시 쓰고 중복 횟수를 센다", () => {
    const tracks = [track("a", 300), track("b", 300)];
    const { slots, repeatedTrackCount } = arrangePlaylist(tracks, { ...baseOptions, sessions: 2 });
    expect(slots[0].tracks.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(slots[2].tracks.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(repeatedTrackCount).toBe(2);
  });

  it("곡이 1개뿐이어도 동작한다", () => {
    const { slots } = arrangePlaylist([track("only", 580)], baseOptions);
    expect(slots[0].tracks.map((t) => t.id)).toEqual(["only"]);
    expect(Math.abs(slots[0].deviationSec)).toBeLessThanOrEqual(TOLERANCE_SEC);
  });

  it("곡이 없으면 경고가 있는 빈 구간을 만든다", () => {
    const { slots } = arrangePlaylist([], baseOptions);
    expect(slots[0].tracks).toEqual([]);
    expect(slots[0].warning).toBeDefined();
  });

  it("구간 안에서는 원래 플레이리스트 순서를 유지한다", () => {
    const tracks = [track("a", 200), track("b", 200), track("c", 200)];
    const { slots } = arrangePlaylist(tracks, baseOptions);
    expect(slots[0].tracks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const tracks = [track("a", 300), track("b", 300)];
    const snapshot = JSON.stringify(tracks);
    arrangePlaylist(tracks, baseOptions);
    expect(JSON.stringify(tracks)).toBe(snapshot);
  });
});
