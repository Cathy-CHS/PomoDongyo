import { describe, expect, it } from "vitest";
import { fetchPlaylist, PlaylistError } from "./fetchPlaylist";
import { parseIsoDuration } from "./parseDuration";
import { parsePlaylistUrl } from "./parsePlaylistUrl";

describe("parsePlaylistUrl", () => {
  const id = "PLabcdefghij1234567";

  it("플레이리스트 링크에서 ID를 추출한다", () => {
    expect(parsePlaylistUrl(`https://www.youtube.com/playlist?list=${id}`)).toBe(id);
  });

  it("watch 링크에 list가 있어도 추출한다", () => {
    expect(parsePlaylistUrl(`https://www.youtube.com/watch?v=abc&list=${id}&index=2`)).toBe(id);
  });

  it("프로토콜이 없어도, 모바일/뮤직 도메인이어도 허용한다", () => {
    expect(parsePlaylistUrl(`m.youtube.com/playlist?list=${id}`)).toBe(id);
    expect(parsePlaylistUrl(`https://music.youtube.com/playlist?list=${id}`)).toBe(id);
  });

  it("잘못된 입력은 null", () => {
    expect(parsePlaylistUrl("")).toBeNull();
    expect(parsePlaylistUrl("hello")).toBeNull();
    expect(parsePlaylistUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(parsePlaylistUrl(`https://example.com/playlist?list=${id}`)).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  it("시/분/초를 초로 변환한다", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT5M")).toBe(300);
  });

  it("라이브(P0D)나 잘못된 값은 0", () => {
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration("abc")).toBe(0);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchPlaylist", () => {
  it("곡 목록을 합치고 재생 불가 영상은 제외한다", async () => {
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/playlistItems")) {
        return jsonResponse({
          items: [
            { snippet: { title: "A", resourceId: { videoId: "a" } } },
            { snippet: { title: "B", resourceId: { videoId: "b" } } },
            { snippet: { title: "Deleted video", resourceId: { videoId: "gone" } } },
            { snippet: { title: "A again", resourceId: { videoId: "a" } } },
          ],
        });
      }
      return jsonResponse({
        items: [
          { id: "a", contentDetails: { duration: "PT3M" }, status: { embeddable: true } },
          { id: "b", contentDetails: { duration: "PT4M" }, status: { embeddable: false } },
        ],
      });
    }) as typeof fetch;

    const result = await fetchPlaylist("PLx", "key", fetchMock);
    expect(result.tracks).toEqual([{ id: "a", title: "A", durationSec: 180 }]);
    expect(result.excludedCount).toBe(2);
  });

  it("비공개 플레이리스트는 PRIVATE 에러", async () => {
    const fetchMock = (async () =>
      jsonResponse({ error: { errors: [{ reason: "playlistForbidden" }] } }, 403)) as typeof fetch;
    await expect(fetchPlaylist("PLx", "key", fetchMock)).rejects.toMatchObject({
      code: "PRIVATE",
    });
  });

  it("할당량 초과는 QUOTA_EXCEEDED 에러", async () => {
    const fetchMock = (async () =>
      jsonResponse({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403)) as typeof fetch;
    const promise = fetchPlaylist("PLx", "key", fetchMock);
    await expect(promise).rejects.toBeInstanceOf(PlaylistError);
    await expect(promise).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });
});
