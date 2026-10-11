const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

/**
 * 유튜브 링크에서 플레이리스트 ID(`list` 파라미터)를 추출한다.
 * 유효하지 않으면 null을 반환한다.
 */
export function parsePlaylistUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const listId = url.searchParams.get("list");
  if (!listId || !PLAYLIST_ID_PATTERN.test(listId)) return null;

  return listId;
}
