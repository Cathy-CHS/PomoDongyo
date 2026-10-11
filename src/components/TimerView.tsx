"use client";

import { formatClock } from "@/lib/format";
import { usePomodoro } from "@/lib/timer/usePomodoro";
import type { PomodoroOptions, SessionResult, Slot } from "@/lib/types";

interface Props {
  slots: Slot[];
  options: PomodoroOptions;
  onFinish: (result: SessionResult) => void;
}

export default function TimerView({ slots, options, onFinish }: Props) {
  const session = usePomodoro({ slots, options, onFinish });
  const { slot, phase } = session;
  const currentTrack = session.trackIndex >= 0 ? slot.tracks[session.trackIndex] : undefined;
  const progress = 1 - session.remainingSec / slot.targetSec;
  const nextSlot = slots[session.slotIndex + 1];

  return (
    <section className="card timer">
      <p className="muted">
        세션 {slot.session} / {options.sessions} · {slot.type === "focus" ? "집중" : "휴식"}
      </p>

      <div className="clock" aria-live="off">
        {formatClock(session.remainingSec)}
      </div>
      <div className="bar">
        <div style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
      </div>

      <div className="now-playing">
        {currentTrack ? (
          <>
            <strong>{currentTrack.title}</strong>
            <span className="muted">
              {formatClock(session.trackElapsedSec)} / {formatClock(currentTrack.durationSec)}
            </span>
          </>
        ) : (
          <span className="muted">
            {phase === "ready"
              ? "시작 버튼이나 영상을 눌러 시작해요."
              : slot.tracks.length > 0
                ? "이번 구간의 곡을 모두 들었어요. 남은 시간은 조용히 집중해요."
                : "음악 없이 쉬는 시간이에요."}
          </span>
        )}
      </div>

      {/* YouTube 약관상 플레이어는 화면에 보이도록 둔다 */}
      <div className="player" ref={session.containerRef} />
      <p className="muted">영상을 눌러도 재생/일시정지돼요. 곡 건너뛰기는 할 수 없어요.</p>

      {slot.tracks.length > 0 && (
        <ul className="tracks queue">
          {slot.tracks.map((track, index) => (
            <li key={track.id} className={index === session.trackIndex ? "current" : ""}>
              <span className="title">{track.title}</span>
              <span className="muted">{formatClock(track.durationSec)}</span>
            </li>
          ))}
        </ul>
      )}

      {nextSlot && (
        <p className="muted">
          다음: {nextSlot.type === "focus" ? "집중" : "휴식"} {formatClock(nextSlot.targetSec)}
        </p>
      )}

      <div className="row">
        {phase === "ready" && (
          <button type="button" onClick={session.start} disabled={!session.playerReady}>
            {session.playerReady ? "시작" : "플레이어 준비 중…"}
          </button>
        )}
        {phase === "running" && (
          <button type="button" onClick={session.pause}>
            일시정지
          </button>
        )}
        {phase === "paused" && (
          <button type="button" onClick={session.resume}>
            계속하기
          </button>
        )}
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="secondary" onClick={session.stopEarly}>
            그만하고 영수증 받기
          </button>
        )}
      </div>
    </section>
  );
}
