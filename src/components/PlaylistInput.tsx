"use client";

import { FormEvent, useState } from "react";
import type { Track } from "@/lib/types";

interface Props {
  onLoaded: (tracks: Track[], excludedCount: number) => void;
}

export default function PlaylistInput({ onLoaded }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/playlist?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "플레이리스트를 불러오지 못했어요.");
        return;
      }
      if (!data.tracks?.length) {
        setError("재생할 수 있는 곡이 없어요. 다른 플레이리스트를 시도해 보세요.");
        return;
      }
      onLoaded(data.tracks, data.excludedCount ?? 0);
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>1. 플레이리스트 불러오기</h2>
      <p className="muted">유튜브 플레이리스트 링크를 붙여넣어 주세요. (공개 또는 일부 공개)</p>
      <div className="row">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/playlist?list=..."
          aria-label="유튜브 플레이리스트 링크"
        />
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? "불러오는 중…" : "불러오기"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
