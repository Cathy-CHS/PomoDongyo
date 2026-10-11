// YouTube IFrame Player API 중 이 프로젝트에서 쓰는 부분만 선언한다.

declare namespace YT {
  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }

  interface OnErrorEvent extends PlayerEvent {
    data: number;
  }

  interface PlayerOptions {
    width?: number | string;
    height?: number | string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    getCurrentTime(): number;
    destroy(): void;
  }

  const PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
