"use client";

import { useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "@/lib/player/useYouTubePlayer";
import type { ListenEntry, PomodoroOptions, SessionResult, Slot, Track } from "@/lib/types";

const TICK_MS = 250;
const MIN_LISTEN_SEC = 1; // 이보다 짧게 들은 곡은 기록하지 않는다

export type SessionPhase = "ready" | "running" | "paused" | "finished";

interface CurrentTrack {
  slotIndex: number;
  trackIndex: number;
  track: Track;
}

interface Params {
  slots: Slot[];
  options: PomodoroOptions;
  onFinish: (result: SessionResult) => void;
}

/**
 * 곡 단위 포모도로 진행 엔진.
 * 타이머는 setInterval 카운트가 아니라 종료 시각(Date.now) 기준으로 계산해
 * 백그라운드 탭에서 타이머가 느려져도 시간이 어긋나지 않는다.
 */
export function usePomodoro({ slots, options, onFinish }: Params) {
  const [phase, setPhase] = useState<SessionPhase>("ready");
  const [slotIndex, setSlotIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(-1); // -1: 재생 중인 곡 없음
  const [remainingSec, setRemainingSec] = useState(slots[0]?.targetSec ?? 0);
  const [trackElapsedSec, setTrackElapsedSec] = useState(0);

  // 렌더와 무관하게 유지해야 하는 값들
  const slotEndAtRef = useRef(0);
  const pausedRemainingMsRef = useRef(0);
  const currentTrackRef = useRef<CurrentTrack | null>(null);
  const entriesRef = useRef<ListenEntry[]>([]);
  const focusElapsedMsRef = useRef(0);
  const startedAtRef = useRef<Date | null>(null);
  const phaseRef = useRef<SessionPhase>("ready");
  const slotIndexRef = useRef(0);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const updatePhase = (next: SessionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // 현재 재생 중인 곡의 청취 기록을 닫는다.
  const closeCurrentTrack = (listenedSec: number) => {
    const current = currentTrackRef.current;
    currentTrackRef.current = null;
    if (!current) return;

    const clamped = Math.min(listenedSec, current.track.durationSec);
    if (clamped < MIN_LISTEN_SEC) return;
    const slot = slots[current.slotIndex];
    entriesRef.current.push({
      slotIndex: current.slotIndex,
      session: slot.session,
      slotType: slot.type,
      track: current.track,
      listenedSec: Math.round(clamped),
    });
  };

  const playTrack = (targetSlotIndex: number, targetTrackIndex: number) => {
    const track = slots[targetSlotIndex]?.tracks[targetTrackIndex];
    setTrackElapsedSec(0);
    if (!track) {
      currentTrackRef.current = null;
      setTrackIndex(-1);
      return;
    }
    currentTrackRef.current = { slotIndex: targetSlotIndex, trackIndex: targetTrackIndex, track };
    setTrackIndex(targetTrackIndex);
    player.loadVideo(track.id);
  };

  const player = useYouTubePlayer({
    // 곡이 끝까지 재생됨 → 다음 곡. 구간 곡이 소진되면 타이머가 끝날 때까지 정적.
    onEnded: () => {
      const current = currentTrackRef.current;
      if (!current || phaseRef.current !== "running") return;
      closeCurrentTrack(current.track.durationSec);
      playTrack(current.slotIndex, current.trackIndex + 1);
    },
    // 재생 불가 영상은 건너뛴다.
    onError: () => {
      const current = currentTrackRef.current;
      if (!current || phaseRef.current !== "running") return;
      closeCurrentTrack(0);
      playTrack(current.slotIndex, current.trackIndex + 1);
    },
  });

  const startSlot = (index: number) => {
    const slot = slots[index];
    slotIndexRef.current = index;
    setSlotIndex(index);
    slotEndAtRef.current = Date.now() + slot.targetSec * 1000;
    setRemainingSec(slot.targetSec);
    playTrack(index, 0);
  };

  const finish = (completed: boolean) => {
    if (phaseRef.current === "finished") return;
    updatePhase("finished");
    player.stop();
    onFinishRef.current({
      startedAt: (startedAtRef.current ?? new Date()).toISOString(),
      endedAt: new Date().toISOString(),
      completed,
      focusElapsedSec: Math.round(focusElapsedMsRef.current / 1000),
      entries: entriesRef.current,
      options,
    });
  };

  // 현재 구간에서 지금까지 흐른 시간을 집중 시간에 더한다.
  const accumulateFocus = (elapsedMs: number) => {
    if (slots[slotIndexRef.current]?.type === "focus") focusElapsedMsRef.current += elapsedMs;
  };

  const endSlot = () => {
    closeCurrentTrack(player.getCurrentTime());
    player.stop();
    accumulateFocus(slots[slotIndexRef.current].targetSec * 1000);

    const next = slotIndexRef.current + 1;
    if (next >= slots.length) {
      finish(true);
    } else {
      startSlot(next);
    }
  };

  // 최신 클로저를 interval에서 쓰기 위한 ref
  const tickRef = useRef<() => void>(() => {});
  tickRef.current = () => {
    const remainingMs = slotEndAtRef.current - Date.now();
    if (remainingMs <= 0) {
      endSlot();
      return;
    }
    setRemainingSec(Math.ceil(remainingMs / 1000));
    if (currentTrackRef.current) setTrackElapsedSec(Math.floor(player.getCurrentTime()));
  };

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => tickRef.current(), TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = () => {
    if (phaseRef.current !== "ready" || slots.length === 0) return;
    startedAtRef.current = new Date();
    updatePhase("running");
    startSlot(0);
  };

  const pause = () => {
    if (phaseRef.current !== "running") return;
    pausedRemainingMsRef.current = Math.max(0, slotEndAtRef.current - Date.now());
    player.pause();
    updatePhase("paused");
  };

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    slotEndAtRef.current = Date.now() + pausedRemainingMsRef.current;
    if (currentTrackRef.current) player.resume();
    updatePhase("running");
  };

  // 중간 종료: 지금까지 들은 곡만 결과에 남는다.
  const stopEarly = () => {
    if (phaseRef.current === "ready" || phaseRef.current === "finished") return;
    const remainingMs =
      phaseRef.current === "paused"
        ? pausedRemainingMsRef.current
        : Math.max(0, slotEndAtRef.current - Date.now());
    const slot = slots[slotIndexRef.current];
    accumulateFocus(Math.max(0, slot.targetSec * 1000 - remainingMs));
    closeCurrentTrack(player.getCurrentTime());
    finish(false);
  };

  return {
    containerRef: player.containerRef,
    playerReady: player.ready,
    phase,
    slotIndex,
    slot: slots[slotIndex],
    trackIndex,
    remainingSec,
    trackElapsedSec,
    start,
    pause,
    resume,
    stopEarly,
  };
}
