import type { PomodoroOptions, Rounding } from "@/lib/types";

/** 화면에서 다루는 설정값 (시간은 분 단위) */
export interface Settings {
  focusMin: number;
  breakMin: number;
  sessions: number;
  playBreak: boolean;
  rounding: Rounding;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  breakMin: 5,
  sessions: 3,
  playBreak: false,
  rounding: "up",
};

export const SETTING_LIMITS = {
  focusMin: { min: 1, max: 180 },
  breakMin: { min: 1, max: 60 },
  sessions: { min: 1, max: 12 },
} as const;

const STORAGE_KEY = "pomodongyo:settings";

export function toOptions(settings: Settings): PomodoroOptions {
  return {
    focusSec: settings.focusMin * 60,
    breakSec: settings.breakMin * 60,
    sessions: settings.sessions,
    playBreak: settings.playBreak,
    rounding: settings.rounding,
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    const { focusMin, breakMin, sessions } = SETTING_LIMITS;
    return {
      focusMin: clamp(saved.focusMin, focusMin.min, focusMin.max, DEFAULT_SETTINGS.focusMin),
      breakMin: clamp(saved.breakMin, breakMin.min, breakMin.max, DEFAULT_SETTINGS.breakMin),
      sessions: clamp(saved.sessions, sessions.min, sessions.max, DEFAULT_SETTINGS.sessions),
      playBreak: saved.playBreak === true,
      rounding: saved.rounding === "down" ? "down" : "up",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장소를 쓸 수 없어도 서비스 동작에는 영향이 없다.
  }
}
