import { formatClock, formatKorean } from "@/lib/format";
import type { Arrangement } from "@/lib/types";

interface Props {
  arrangement: Arrangement;
  excludedCount: number; // 불러오는 단계에서 재생 불가로 제외된 영상 수
}

export default function ArrangementPreview({ arrangement, excludedCount }: Props) {
  const { slots, removed, repeatedTrackCount } = arrangement;

  return (
    <section className="card">
      <h2>3. 재배열 결과</h2>

      {(excludedCount > 0 || removed.length > 0 || repeatedTrackCount > 0) && (
        <ul className="notes">
          {excludedCount > 0 && (
            <li>삭제·비공개·임베드 불가 영상 {excludedCount}곡은 불러오지 않았어요.</li>
          )}
          {removed.length > 0 && (
            <li>
              구간보다 긴 {removed.length}곡은 제외했어요:{" "}
              {removed.map((track) => `${track.title} (${formatClock(track.durationSec)})`).join(", ")}
            </li>
          )}
          {repeatedTrackCount > 0 && (
            <li>곡이 부족해 {repeatedTrackCount}곡이 다시 재생돼요.</li>
          )}
        </ul>
      )}

      <ol className="slots">
        {slots.map((slot, index) => (
          <li key={index} className={`slot ${slot.type}`}>
            <div className="slot-head">
              <strong>
                {slot.type === "focus" ? `집중 ${slot.session}` : `휴식 ${slot.session}`}
              </strong>
              <span className="muted">
                {formatKorean(slot.targetSec)}
                {slot.tracks.length > 0 && ` · 곡 합계 ${formatClock(slot.totalSec)}`}
              </span>
            </div>
            {slot.tracks.length > 0 ? (
              <ul className="tracks">
                {slot.tracks.map((track) => (
                  <li key={track.id}>
                    <span className="title">{track.title}</span>
                    <span className="muted">{formatClock(track.durationSec)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              slot.type === "break" && <p className="muted">음악 없이 쉬어요.</p>
            )}
            {slot.warning && <p className="warn">⚠ {slot.warning}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
