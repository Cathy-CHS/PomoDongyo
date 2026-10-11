"use client";

import { useEffect, useState } from "react";
import { SETTING_LIMITS, type Settings } from "@/lib/settings";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

// 입력 중에는 빈 칸도 허용하고, 유효한 값일 때만 반영한다.
function NumberField({ label, unit, value, min, max, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="row tight">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const parsed = Number(event.target.value);
            if (Number.isInteger(parsed) && parsed >= min && parsed <= max) onCommit(parsed);
          }}
          onBlur={() => setText(String(value))}
        />
        <span className="muted">{unit}</span>
      </div>
    </label>
  );
}

export default function SettingsForm({ settings, onChange }: Props) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <section className="card">
      <h2>2. 옵션 설정</h2>
      <div className="grid">
        <NumberField
          label="집중 시간"
          unit="분"
          value={settings.focusMin}
          {...SETTING_LIMITS.focusMin}
          onCommit={(focusMin) => update({ focusMin })}
        />
        <NumberField
          label="휴식 시간"
          unit="분"
          value={settings.breakMin}
          {...SETTING_LIMITS.breakMin}
          onCommit={(breakMin) => update({ breakMin })}
        />
        <NumberField
          label="세션 수"
          unit="회"
          value={settings.sessions}
          {...SETTING_LIMITS.sessions}
          onCommit={(sessions) => update({ sessions })}
        />
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.playBreak}
          onChange={(event) => update({ playBreak: event.target.checked })}
        />
        휴식 시간에도 음악 재생
      </label>

      <div className="field">
        <span>곡 길이 합이 구간 시간과 맞지 않을 때</span>
        <div className="segmented" role="radiogroup" aria-label="올림 또는 내림">
          <button
            type="button"
            role="radio"
            aria-checked={settings.rounding === "up"}
            className={settings.rounding === "up" ? "active" : ""}
            onClick={() => update({ rounding: "up" })}
          >
            올림 (조금 더 듣기)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.rounding === "down"}
            className={settings.rounding === "down" ? "active" : ""}
            onClick={() => update({ rounding: "down" })}
          >
            내림 (조금 덜 듣기)
          </button>
        </div>
      </div>
    </section>
  );
}
