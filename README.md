# PomoDongyo

타이머가 아니라 **플레이리스트의 곡 단위**로 집중을 돕는 포모도로 웹 서비스입니다.
유튜브 플레이리스트 링크를 붙여넣으면 집중/휴식 시간에 맞게 곡을 재배열하고, 구간마다 그 곡들을 재생합니다.
끝나면 실제로 들은 곡을 영수증 이미지로 저장·공유할 수 있습니다.

- 상세 계획: [`docs/PLAN.md`](docs/PLAN.md)
- 로그인/DB 없이 동작합니다. 옵션만 브라우저 `localStorage`에 저장됩니다.

## 시작하기

요구 사항: Node.js 18.17 이상

```bash
npm install
cp .env.example .env.local   # YOUTUBE_API_KEY 입력
npm run dev                  # http://localhost:3000
```

### YouTube API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들고 **YouTube Data API v3**를 사용 설정합니다.
2. 사용자 인증 정보에서 API 키를 만들고 `.env.local`의 `YOUTUBE_API_KEY`에 넣습니다.
3. 키는 서버(`/api/playlist`)에서만 사용되며 브라우저로 전달되지 않습니다.

플레이리스트 조회 1회는 보통 API 2~3유닛을 쓰며, 무료 할당량은 하루 10,000유닛입니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run lint` | ESLint |

## 배포 (Vercel)

1. 저장소를 Vercel에 import 합니다. (Next.js 프리셋이 자동 감지됩니다.)
2. Project Settings → Environment Variables에 `YOUTUBE_API_KEY`를 등록합니다.
3. 배포 후 공개 플레이리스트 링크로 전체 흐름(불러오기 → 재배열 → 재생 → 영수증)을 확인합니다.

## 동작 방식 요약

- 구간 곡 길이 합이 목표 시간과 ±60초 이내가 되도록 곡을 고르고, 맞지 않으면 올림/내림 설정을 따릅니다.
- 집중/휴식 중 더 긴 시간보다 긴 곡은 제외하고, 곡 중복은 모두 한 번씩 쓴 뒤에만 허용합니다.
- 구간 시간이 끝나면 남은 곡이 있어도 정지하고 다음 구간으로 넘어갑니다.

## 알려진 제한

- 임베드가 막힌 영상, 비공개/삭제된 영상은 제외됩니다.
- 모바일 브라우저는 화면이 꺼지면 재생이 멈출 수 있습니다.
- YouTube 이용약관상 플레이어는 화면에 보이도록 두었습니다.
