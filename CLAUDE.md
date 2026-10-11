# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 지침입니다.

## 프로젝트 개요

PomoDongyo — 타이머가 아닌 **플레이리스트의 곡 단위**로 집중을 돕는 포모도로 웹 서비스.
유튜브 플레이리스트를 불러와 집중/휴식 구간 길이에 맞게 곡을 재배열하고, 구간마다 해당 곡들을 재생한다. 종료 후에는 실제로 들은 곡을 영수증 이미지로 내보낸다.

- 범위: **웹사이트만** (모바일 앱 제외). 로그인/DB 없음. 최소 기능으로 동작하고 배포 가능한 상태가 목표.
- 상세 계획: `docs/PLAN.md` (구현 전 반드시 참고)
- 현재 상태: 웹 MVP 구현됨 (Next.js 14 + React 18, Node 18.17 환경 기준).

## 명령어

- `npm run dev` — 개발 서버 (`.env.local`에 `YOUTUBE_API_KEY` 필요, 예시는 `.env.example`)
- `npm test` — Vitest 단위 테스트 (`src/lib/**/*.test.ts`)
- `npm run lint` / `npm run build` — ESLint / 프로덕션 빌드

## 언어 및 커뮤니케이션 규칙

- **기본 응답 언어**: 한국어
- **코드 주석**: 한국어로 작성
- **커밋 메시지**: 한국어로 작성
- **문서화**: 한국어로 작성
- **변수명/함수명**: 영어 (코드 표준 준수)

## 기술 스택

- **Next.js (App Router) + TypeScript**, Vercel 배포. API 키를 숨기는 서버 Route Handler를 같은 프로젝트에 둔다.
- **YouTube Data API v3 필요** (링크만으로는 곡 목록·길이를 알 수 없음):
  - `playlistItems.list` (maxResults=50, nextPageToken 반복) → 영상 ID/제목
  - `videos.list?part=contentDetails,status` (50개씩 배치) → ISO8601 duration, embeddable 여부
  - 호출당 1유닛, 일 10,000유닛 무료 할당량. 환경변수 `YOUTUBE_API_KEY`는 서버에서만 사용.
- **재생**: YouTube IFrame Player API. 우리가 만든 큐를 `loadVideoById`로 직접 순차 재생 (유튜브 자체 플리 순서에 의존 X).
- **상태**: 클라이언트 React 상태(+ 옵션 설정만 localStorage). 서버 저장 없음.
- **영수증 이미지**: `html-to-image`로 DOM → PNG, Web Share API 지원 시 공유, 아니면 다운로드.
- **테스트**: Vitest (재배열 알고리즘 단위 테스트가 핵심).

## 디렉터리 구조 (신규)
```
src/app/page.tsx                  # 단일 페이지: 입력 → 설정 → 미리보기 → 타이머 → 영수증 (단계 전환)
src/app/api/playlist/route.ts     # GET ?url= → {tracks:[{id,title,durationSec,embeddable}]}
src/lib/youtube/parsePlaylistUrl.ts   # URL에서 list= 파라미터 추출/검증
src/lib/youtube/fetchPlaylist.ts      # Data API 호출, 페이지네이션, 배치, duration 파싱
src/lib/scheduler/arrange.ts      # 재배열 알고리즘 (순수 함수, 테스트 대상)
src/lib/timer/usePomodoro.ts      # 타임스탬프 기반 타이머 훅
src/lib/player/useYouTubePlayer.ts    # IFrame API 래퍼 + 곡 큐 진행
src/components/{PlaylistInput,SettingsForm,ArrangementPreview,TimerView,Receipt}.tsx
```

## 기능별 구현

### 1. Playlist Import
- 입력 URL에서 `list=` 추출 (`youtube.com/playlist?list=`, `watch?v=..&list=` 모두 허용). 실패 시 오류 안내.
- `/api/playlist` 가 위 두 API를 호출. 비공개/삭제된 영상, `embeddable=false`, 길이 0(라이브) 곡은 제외하고 제외 개수를 UI에 표시.
- 비공개 플리·존재하지 않는 플리·할당량 초과는 각각 구분된 에러 메시지.
- 타 스트리밍(Apple Music 등)은 MVP 제외. `Track` 타입과 fetch 계층을 provider 인터페이스로 분리해 두어 이후 확장 가능하게만 한다.

### 2. 옵션 (SettingsForm)
집중 분(기본 25), 휴식 분(기본 5), 세션 수(기본 3), 휴식 중 음악 재생(기본 OFF), 길이 불일치 시 올림/내림(기본 올림). 허용 오차는 상수 60초.

### 3. 재배열 알고리즘 (`arrange.ts`)
입력: tracks, focusSec, breakSec, sessions, playBreak, rounding. 출력: 슬롯 배열 `[{type:'focus'|'break', targetSec, tracks[], totalSec, deviationSec}]`.
1. 슬롯 순서: `F1, (B1), F2, (B2), … Fn` — 마지막 세션 뒤 휴식은 생략. 휴식 음악 OFF면 휴식 슬롯은 무음 타이머만.
2. 필터: `maxSec = max(focusSec, breakSec)` 초과 곡 제거 (사양 5-4). 제거 목록을 미리보기에 표시. (휴식 음악 OFF일 때도 사양대로 동일 기준 적용.)
3. 슬롯마다 아직 안 쓴 곡 풀에서 **부분집합 합 DP**(초 단위, n이 작아 충분)로 후보 선택:
   - 합이 `[target−60, target+60]` 안인 후보만 유효. 정확히 일치 > 지정 방향(올림=target 이상 중 최소 / 내림=target 이하 중 최대) > 반대 방향 순으로 선호.
   - 동률이면 원래 플리 순서에 가까운 조합 선택, 슬롯 내부는 원래 순서로 정렬.
   - 오차 내 조합이 없으면 지정 방향 기준 최근접 조합으로 대체하고 `warning` 표시.
4. 중복 최소화: 모든 곡을 한 번씩 쓸 때까지 재사용 금지. 풀 소진 시에만 전체 곡으로 풀 재충전.
5. 플리 총 길이가 부족해 반복이 생기면 미리보기에 "곡이 N회 반복됨" 안내.
6. 순수 함수 + Vitest: 정확 일치, 올림/내림, 오차 초과 경고, 긴 곡 제거, 중복 최소화, 휴식 음악 ON/OFF, 곡이 1개뿐인 경우, 빈 입력.

### 4. 타이머 진행 (TimerView)
- "시작" 클릭(사용자 제스처 → 자동재생 정책 충족) 시 첫 슬롯 시간 표시 + 큐 재생.
- 타이머는 `Date.now()` 기준 종료 시각 계산 (백그라운드 탭 throttle 대응). 현재 곡 제목, 곡 경과/전체 시간, 구간 남은 시간, 세션 n/N 표시.
- 곡 `ENDED` 이벤트 → 다음 곡 `loadVideoById`. 구간 종료 시 플레이어 정지 후 다음 슬롯으로 자동 전환 (시계가 기준; 올림으로 곡이 남아 있으면 페이드 없이 정지 — 오차 ≤1분).
- 일시정지/중단 버튼. 곡별 실제 재생 구간(들은 시간)을 기록.

### 5. 영수증 Export
- 종료/중단 시 기록된 **실제로 들은 곡만**으로 영수증 컴포넌트 렌더 (세션별 곡 목록, 시간, 총 집중 시간, 날짜). 감성적인 영수증 스타일(모노스페이스, 점선, 바코드 느낌).
- PNG 저장 + Web Share API 공유.

## 단계별 작업 순서
1. Next.js + TS + ESLint + Vitest 스캐폴딩, `.env.example`(`YOUTUBE_API_KEY`) 추가.
2. `parsePlaylistUrl`, `fetchPlaylist`, `/api/playlist` + 단위 테스트(duration 파서, URL 파서).
3. `arrange.ts` + 테스트 (핵심).
4. 입력/설정/미리보기 UI 연결 (재배열 결과 리스트업).
5. 플레이어 + 타이머 훅, TimerView.
6. 영수증 컴포넌트 + 내보내기.
7. Vercel 배포 설정, 환경변수 등록, README(한국어) 작성.

## 열린 이슈 / 리스크
- 구간 종료 시 시계 기준으로 끊을지(현재안), 마지막 곡 종료까지 기다릴지는 구현 후 체감해서 조정.
- 일부 영상은 임베드 불가 → 제외 처리로 대응.
- iOS Safari 등 모바일 브라우저는 백그라운드 재생 제한이 있을 수 있음 (이번 범위 밖, 안내만).

## 검증
- `npm test`: 알고리즘/파서 단위 테스트 통과.
- 로컬 `npm run dev` + 실제 `YOUTUBE_API_KEY`로: 공개 플리 URL 붙여넣기 → 곡 목록/길이 표시 → 1분 집중·1분 휴식·2세션 같은 짧은 설정으로 전체 흐름(재생, 자동 전환, 종료) 확인 → 중간 중단 시 영수증에 들은 곡만 나오는지 확인 → PNG 저장 확인.
- 비공개 플리/잘못된 URL/키 누락 에러 메시지 확인.
- `npm run build` 성공 후 Vercel 프리뷰 배포에서 동일 흐름 재확인.
