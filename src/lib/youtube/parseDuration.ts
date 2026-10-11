const ISO_DURATION_PATTERN = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * ISO 8601 duration(예: PT4M13S)을 초 단위로 변환한다.
 * 해석할 수 없으면 0을 반환한다. (라이브 영상은 P0D로 오며 0이 된다.)
 */
export function parseIsoDuration(iso: string): number {
  const match = ISO_DURATION_PATTERN.exec(iso);
  if (!match) return 0;

  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}
