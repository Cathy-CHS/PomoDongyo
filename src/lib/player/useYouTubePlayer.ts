"use client";

import { useCallback, useEffect, useRef, useState } from "react";

let apiPromise: Promise<void> | null = null;

/** IFrame API 스크립트를 한 번만 불러온다. */
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

interface PlayerHandlers {
  onEnded: () => void;
  onError: (code: number) => void;
}

/**
 * YouTube IFrame Player 래퍼.
 * containerRef가 가리키는 요소 안에 플레이어를 만들고, 곡 단위 재생을 제어한다.
 */
export function useYouTubePlayer(handlers: PlayerHandlers) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const handlersRef = useRef(handlers);
  const [ready, setReady] = useState(false);

  // 최신 콜백을 항상 참조하도록 렌더마다 갱신
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;

      // React가 관리하지 않는 자식 요소를 만들어 플레이어가 교체하도록 한다.
      const mount = document.createElement("div");
      container.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) handlersRef.current.onEnded();
          },
          onError: (event) => handlersRef.current.onError(event.data),
        },
      });
    });

    return () => {
      cancelled = true;
      setReady(false);
      playerRef.current?.destroy();
      playerRef.current = null;
      container.replaceChildren();
    };
  }, []);

  const loadVideo = useCallback((videoId: string) => playerRef.current?.loadVideoById(videoId), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const resume = useCallback(() => playerRef.current?.playVideo(), []);
  const stop = useCallback(() => playerRef.current?.stopVideo(), []);
  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);

  return { containerRef, ready, loadVideo, pause, resume, stop, getCurrentTime };
}
