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
  // 임베드 쪽에서 재생 상태가 바뀔 때 호출된다 (YT.PlayerState 값)
  onStateChange?: (state: number) => void;
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
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 0, // 재생 제어는 앱의 버튼으로만 한다
          disablekb: 1, // 키보드 단축키(재생/탐색) 비활성화
          fs: 0, // 전체화면 버튼/더블클릭 전체화면 비활성화
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) handlersRef.current.onEnded();
            handlersRef.current.onStateChange?.(event.data);
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
  // 재생하지 않고 영상만 불러 둔다. (시작 전에 영상을 눌러도 정상 재생되게 하기 위함)
  const cueVideo = useCallback((videoId: string) => playerRef.current?.cueVideoById(videoId), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const resume = useCallback(() => playerRef.current?.playVideo(), []);
  const stop = useCallback(() => playerRef.current?.stopVideo(), []);
  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);

  return { containerRef, ready, loadVideo, cueVideo, pause, resume, stop, getCurrentTime };
}
