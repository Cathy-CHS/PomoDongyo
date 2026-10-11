"use client";

import { useEffect, useMemo, useState } from "react";
import ArrangementPreview from "@/components/ArrangementPreview";
import PlaylistInput from "@/components/PlaylistInput";
import Receipt from "@/components/Receipt";
import SettingsForm from "@/components/SettingsForm";
import TimerView from "@/components/TimerView";
import { arrangePlaylist } from "@/lib/scheduler/arrange";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, toOptions, type Settings } from "@/lib/settings";
import type { PomodoroOptions, SessionResult, Slot, Track } from "@/lib/types";

type Stage = "setup" | "timer" | "receipt";

interface RunPlan {
  slots: Slot[];
  options: PomodoroOptions;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("setup");
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [runPlan, setRunPlan] = useState<RunPlan | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  // 저장된 설정은 마운트 후에 읽어 서버 렌더링과 어긋나지 않게 한다.
  useEffect(() => {
    setSettings(loadSettings());
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (settingsLoaded) saveSettings(settings);
  }, [settings, settingsLoaded]);

  const options = useMemo(() => toOptions(settings), [settings]);
  const arrangement = useMemo(
    () => (tracks ? arrangePlaylist(tracks, options) : null),
    [tracks, options],
  );
  const hasMusic = arrangement?.slots.some((slot) => slot.tracks.length > 0) ?? false;

  const handleStart = () => {
    if (!arrangement) return;
    setRunPlan({ slots: arrangement.slots, options });
    setStage("timer");
  };

  const handleFinish = (finished: SessionResult) => {
    setResult(finished);
    setStage("receipt");
  };

  const handleRestart = () => {
    setRunPlan(null);
    setResult(null);
    setStage("setup");
  };

  return (
    <main className="container">
      <header>
        <h1>PomoDongyo</h1>
        <p className="muted">타이머 말고, 플레이리스트의 곡으로 집중해요.</p>
      </header>

      {stage === "setup" && (
        <>
          <PlaylistInput
            onLoaded={(loaded, excluded) => {
              setTracks(loaded);
              setExcludedCount(excluded);
            }}
          />

          {tracks && arrangement && (
            <>
              <SettingsForm settings={settings} onChange={setSettings} />
              <ArrangementPreview arrangement={arrangement} excludedCount={excludedCount} />
              <div className="row">
                <button type="button" onClick={handleStart} disabled={!hasMusic}>
                  집중하러 가기
                </button>
              </div>
              {!hasMusic && (
                <p className="error">재생할 수 있는 곡이 없어요. 옵션을 바꾸거나 다른 플레이리스트를 불러와 주세요.</p>
              )}
            </>
          )}
        </>
      )}

      {stage === "timer" && runPlan && (
        <TimerView slots={runPlan.slots} options={runPlan.options} onFinish={handleFinish} />
      )}

      {stage === "receipt" && result && <Receipt result={result} onRestart={handleRestart} />}
    </main>
  );
}
