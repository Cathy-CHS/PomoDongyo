// 서비스 전반에서 공유하는 타입

export interface Track {
  id: string; // 유튜브 영상 ID
  title: string;
  durationSec: number;
}

export type Rounding = "up" | "down";

export interface PomodoroOptions {
  focusSec: number;
  breakSec: number;
  sessions: number;
  playBreak: boolean;
  rounding: Rounding;
}

export type SlotType = "focus" | "break";

export interface Slot {
  type: SlotType;
  session: number; // 1부터 시작하는 세션 번호
  targetSec: number; // 구간(타이머) 길이
  tracks: Track[];
  totalSec: number; // 배정된 곡 길이 합
  deviationSec: number; // totalSec - targetSec (양수: 초과, 음수: 부족)
  warning?: string;
}

export interface Arrangement {
  slots: Slot[];
  removed: Track[]; // 길이 때문에 제외된 곡
  repeatedTrackCount: number; // 중복 재생되는 곡 횟수
}

// 영수증에 쓰이는 청취 기록
export interface ListenEntry {
  slotIndex: number;
  session: number;
  slotType: SlotType;
  track: Track;
  listenedSec: number;
}

export interface SessionResult {
  startedAt: string; // ISO
  endedAt: string; // ISO
  completed: boolean; // 끝까지 완주했는지
  focusElapsedSec: number; // 실제로 보낸 집중 시간
  entries: ListenEntry[];
  options: PomodoroOptions;
}
