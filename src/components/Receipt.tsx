"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { formatClock, formatKorean } from "@/lib/format";
import type { ListenEntry, SessionResult } from "@/lib/types";

interface Props {
  result: SessionResult;
  onRestart: () => void;
}

function groupBySlot(entries: ListenEntry[]): ListenEntry[][] {
  const groups = new Map<number, ListenEntry[]>();
  for (const entry of entries) {
    groups.set(entry.slotIndex, [...(groups.get(entry.slotIndex) ?? []), entry]);
  }
  return [...groups.values()];
}

export default function Receipt({ result, onRestart }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const groups = groupBySlot(result.entries);
  const totalListenedSec = result.entries.reduce((sum, entry) => sum + entry.listenedSec, 0);
  const endedAt = new Date(result.endedAt);

  const render = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    return toPng(receiptRef.current, { pixelRatio: 2, backgroundColor: "#fffdf7" });
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage("");
    try {
      const dataUrl = await render();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `pomodongyo-${endedAt.toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setMessage("이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    setMessage("");
    try {
      const dataUrl = await render();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "pomodongyo-receipt.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "PomoDongyo 영수증" });
      } else {
        setMessage("이 브라우저는 공유를 지원하지 않아요. 이미지 저장을 이용해 주세요.");
      }
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 오류로 보지 않는다.
      if ((error as Error).name !== "AbortError") setMessage("공유하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="receipt-wrap">
      <div className="receipt" ref={receiptRef}>
        <h2>POMODONGYO</h2>
        <p className="center small">— 오늘 들은 곡 영수증 —</p>
        <p className="center small">{endedAt.toLocaleString("ko-KR")}</p>
        <p className="center small">{result.completed ? "완주!" : "중간에 종료했어요"}</p>
        <hr />

        {groups.length === 0 && <p className="center small">들은 곡이 없어요.</p>}

        {groups.map((group) => (
          <div key={group[0].slotIndex} className="receipt-group">
            <p className="group-title">
              {group[0].slotType === "focus" ? "FOCUS" : "BREAK"} #{group[0].session}
            </p>
            {group.map((entry, index) => (
              <div key={`${entry.track.id}-${index}`} className="receipt-row">
                <span className="item">
                  {String(index + 1).padStart(2, "0")} {entry.track.title}
                </span>
                <span className="dots" />
                <span>{formatClock(entry.listenedSec)}</span>
              </div>
            ))}
          </div>
        ))}

        <hr />
        <div className="receipt-row">
          <span>들은 곡</span>
          <span className="dots" />
          <span>{result.entries.length}곡</span>
        </div>
        <div className="receipt-row">
          <span>들은 시간</span>
          <span className="dots" />
          <span>{formatKorean(totalListenedSec)}</span>
        </div>
        <div className="receipt-row total">
          <span>집중한 시간</span>
          <span className="dots" />
          <span>{formatKorean(result.focusElapsedSec)}</span>
        </div>
        <hr />
        <div className="barcode" aria-hidden />
        <p className="center small">THANK YOU FOR FOCUSING</p>
      </div>

      <div className="row center-row">
        <button type="button" onClick={handleSave} disabled={busy}>
          이미지 저장
        </button>
        <button type="button" className="secondary" onClick={handleShare} disabled={busy}>
          공유
        </button>
        <button type="button" className="secondary" onClick={onRestart}>
          처음으로
        </button>
      </div>
      {message && <p className="error center">{message}</p>}
    </section>
  );
}
