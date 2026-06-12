# 아포칼립스 키우기

모바일 우선 웹 기반 2D 횡스크롤 방치형 파밍 RPG입니다. 현재 구현 범위는 Phase 1/2:
프로젝트 스캐폴딩, 고정 타임스텝 루프, PixiJS 사이드뷰 월드, React HUD, 자동 전투입니다.

## 실행

```bash
npm install
npm run dev
```

## Vercel 배포

이 프로젝트는 Vite 정적 앱으로 배포합니다. `vercel.json`에 빌드 설정이 들어가 있으므로 Vercel에서 GitHub 저장소를 Import하면 아래 값이 자동 적용됩니다.

- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

CLI로 배포할 때는 Vercel 계정 인증 후 아래 순서로 진행합니다.

```bash
npx vercel
npx vercel --prod
```

배포 전 로컬 검증:

```bash
npm run build
npm run preview
```

## 폴더 책임

- `src/core/` — 순수 TypeScript 게임 로직. 전투, 물리, AI, 진행, 보상 계산을 담당합니다. Pixi/React/DOM import 금지.
- `src/render/` — PixiJS 렌더링. `core` 상태를 읽어 월드, 플랫폼, 플레이어, 몬스터, HP바, 데미지 텍스트를 그립니다.
- `src/ui/` — React UI. HUD, 임시 버튼, 상태 표시, 안내 패널을 담당합니다.
- `src/data/` — 밸런스, 스테이지, 몬스터, 팔레트 등 정의 데이터의 단일 출처입니다.
- `src/store/` — Zustand 스토어. 시뮬레이션 상태와 UI 상태를 연결합니다.
- `src/save/` — IndexedDB 저장/로드와 오프라인 보상 계산용 타임스탬프를 담당합니다.

## 아키텍처 원칙

- 시뮬레이션은 60tps 고정 타임스텝으로 갱신합니다.
- 렌더링은 PixiJS가 담당하며, 게임 로직에 영향을 주지 않습니다.
- 모든 튜닝 수치는 `src/data/balance.ts`에서 관리합니다.
- 오프라인 보상은 실시간 시뮬레이션 재생이 아니라 마지막 저장 시각과 스테이지 분당 수익의 곱으로 근사합니다.
