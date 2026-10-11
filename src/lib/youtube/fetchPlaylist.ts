import type { Track } from "@/lib/types";
import { parseIsoDuration } from "./parseDuration";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 50;
const MAX_PAGES = 10; // 최대 500곡까지만 읽는다 (할당량 보호)

export type PlaylistErrorCode =
  | "NOT_FOUND"
  | "PRIVATE"
  | "QUOTA_EXCEEDED"
  | "INVALID_KEY"
  | "UPSTREAM";

export class PlaylistError extends Error {
  constructor(
    public code: PlaylistErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlaylistError";
  }
}

export interface PlaylistResult {
  tracks: Track[];
  excludedCount: number; // 삭제/비공개/임베드 불가/라이브 등으로 제외된 영상 수
}

type FetchLike = typeof fetch;

interface PlaylistItemsResponse {
  items?: {
    snippet?: { title?: string; resourceId?: { videoId?: string } };
  }[];
  nextPageToken?: string;
}

interface VideosResponse {
  items?: {
    id: string;
    contentDetails?: { duration?: string };
    status?: { embeddable?: boolean; privacyStatus?: string };
  }[];
}

async function callApi<T>(
  fetchImpl: FetchLike,
  endpoint: string,
  params: Record<string, string>,
): Promise<T> {
  const url = `${API_BASE}/${endpoint}?${new URLSearchParams(params).toString()}`;
  const res = await fetchImpl(url, { cache: "no-store" });

  if (res.ok) return (await res.json()) as T;

  let reason = "";
  try {
    const body = await res.json();
    reason = body?.error?.errors?.[0]?.reason ?? "";
  } catch {
    // 본문이 JSON이 아니면 상태 코드로만 판단한다.
  }

  if (reason === "playlistNotFound" || res.status === 404) {
    throw new PlaylistError("NOT_FOUND", "플레이리스트를 찾을 수 없어요. 링크를 확인해 주세요.");
  }
  if (reason === "playlistForbidden" || reason === "forbidden") {
    throw new PlaylistError("PRIVATE", "비공개 플레이리스트예요. 공개 또는 일부 공개로 바꿔 주세요.");
  }
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
    throw new PlaylistError("QUOTA_EXCEEDED", "오늘 사용할 수 있는 API 할당량을 모두 썼어요. 내일 다시 시도해 주세요.");
  }
  if (reason === "keyInvalid" || reason === "badRequest" || res.status === 400) {
    throw new PlaylistError("INVALID_KEY", "서버의 YouTube API 키 설정에 문제가 있어요.");
  }
  throw new PlaylistError("UPSTREAM", "유튜브에서 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
}

/**
 * 플레이리스트의 곡 목록과 길이를 YouTube Data API v3로 조회한다.
 * 임베드 불가/비공개/삭제/라이브(길이 0) 영상은 제외하고 개수만 센다.
 */
export async function fetchPlaylist(
  playlistId: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<PlaylistResult> {
  // 1) 플레이리스트 항목(영상 ID, 제목) 수집
  const items: { id: string; title: string }[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = {
      part: "snippet",
      playlistId,
      maxResults: String(PAGE_SIZE),
      key: apiKey,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await callApi<PlaylistItemsResponse>(fetchImpl, "playlistItems", params);
    for (const item of data.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      if (id) items.push({ id, title: item.snippet?.title ?? "" });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // 같은 영상이 여러 번 들어 있어도 한 곡으로 취급한다.
  const seenIds = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  // 2) 영상별 길이/임베드 가능 여부를 50개씩 배치 조회
  const detailById = new Map<string, NonNullable<VideosResponse["items"]>[number]>();
  for (let i = 0; i < uniqueItems.length; i += PAGE_SIZE) {
    const ids = uniqueItems.slice(i, i + PAGE_SIZE).map((item) => item.id);
    const data = await callApi<VideosResponse>(fetchImpl, "videos", {
      part: "contentDetails,status",
      id: ids.join(","),
      key: apiKey,
    });
    for (const video of data.items ?? []) detailById.set(video.id, video);
  }

  // 3) 재생 가능한 곡만 남긴다.
  const tracks: Track[] = [];
  for (const item of uniqueItems) {
    const detail = detailById.get(item.id);
    const durationSec = parseIsoDuration(detail?.contentDetails?.duration ?? "");
    const playable =
      detail !== undefined &&
      detail.status?.embeddable !== false &&
      detail.status?.privacyStatus !== "private" &&
      durationSec > 0;

    if (playable) tracks.push({ id: item.id, title: item.title, durationSec });
  }

  return { tracks, excludedCount: uniqueItems.length - tracks.length };
}
