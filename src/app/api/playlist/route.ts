import { NextRequest, NextResponse } from "next/server";
import { fetchPlaylist, PlaylistError, type PlaylistErrorCode } from "@/lib/youtube/fetchPlaylist";
import { parsePlaylistUrl } from "@/lib/youtube/parsePlaylistUrl";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<PlaylistErrorCode, number> = {
  NOT_FOUND: 404,
  PRIVATE: 403,
  QUOTA_EXCEEDED: 429,
  INVALID_KEY: 500,
  UPSTREAM: 502,
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse("NO_API_KEY", "서버에 YOUTUBE_API_KEY가 설정되어 있지 않아요.", 500);
  }

  const url = request.nextUrl.searchParams.get("url") ?? "";
  const playlistId = parsePlaylistUrl(url);
  if (!playlistId) {
    return errorResponse(
      "INVALID_URL",
      "유튜브 플레이리스트 링크가 아니에요. list= 가 포함된 링크를 붙여넣어 주세요.",
      400,
    );
  }

  try {
    const result = await fetchPlaylist(playlistId, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PlaylistError) {
      return errorResponse(error.code, error.message, STATUS_BY_CODE[error.code]);
    }
    return errorResponse("UPSTREAM", "알 수 없는 오류가 발생했어요.", 500);
  }
}
