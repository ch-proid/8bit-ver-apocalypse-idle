# UI 제작 명세 — v5 GB 메뉴 (완전 재현용)

> **단일 진실 공급원: UI목업_v5_GB메뉴.html** — 이 문서는 그 목업을 React로 옮길 때의 규칙서다.
> 수치·색·간격이 문서와 목업이 다르면 **목업이 우선**한다. 목업의 마크업 구조와 CSS를
> 임의 "개선"하지 말고 그대로 포팅한다. 단, 목업의 데모용 canvas 게임 화면과
> DEV 링크 줄(.dev-silk)은 실구현에서 제외한다(게임 화면은 PixiJS 캔버스로 치환).

## 1. 디자인 토큰 (CSS 변수 — 전역 단일 정의)

| 그룹 | 토큰 | 값 |
|---|---|---|
| LCD 기본 | --bg / --mid / --light / --accent | #18212a / #4e6a79 / #d8e3c8 / #7da963 |
| LCD 보조 | --line / --ink | #26333f / #0a0e13 |
| 의미색 | --blood / --gold | #c0303a / #e0c04a |
| 등급 | common/magic/rare/epic/leg | #8d93a0 / #4a9be0 / #e0c04a / #a45ae0 / #e08a3a |
| 셸 | --shell / --shell-hi / --shell-lo / --silk | #5e8748 / #8db86e / #39562d / #2c4222 |
| DMG 팔레트 | (게임 캔버스 전용 5톤) | #081820 #0f380f #346856 #88c070 #e0f8d0 |

## 2. 타이포·언어 규칙

- **시스템 텍스트(라벨·수치) = 'Courier New' 모노스페이스 bold.** 실구현에서 영문·숫자
  비트맵 폰트로 교체 가능하나 크기 체계는 유지.
- **한국어(.kr 클래스) = 시스템 sans → 실구현은 Galmuri11(비트맵 한글 폰트) 적용.**
  한국어가 허용되는 곳: 유물명, 죄 이름, 게임의 목소리(보이스 라인) **만**.
- **언어 규칙: 시스템은 영어 약자로, 세계는 한국어로 말한다.**
  약자 사전: ATK DEF HP REG(회복) PT(포인트) CP LV RE(환생기록) EXP /
  CRI(치명확률) CRD(치명피해) SPD(공속) DMG(피해) SIN(죄의 옵션) /
  SUMMON PICK(지정) RITE(소환 횟수) RENEW CUBE SELL AUTO EQUIP REROLL CLAIM REBIRTH /
  프리셋 ATK·BAL·VIT·MAN / 데크 STAT·GEAR·ALTAR·SELECT·START.
- **미니멀 원칙(위반 금지)**: 설명·안내 문장 금지. 숫자와 동사만. 미해금 정보는 `?`
  (도감 미발견 = `?`, 다음 ★효과 = `★3 ?`). 보이스 라인은 패널이 아닌 팝업·연출에서만,
  담담체 한 문장(예: "제단이 깨어났다.", "화력이 부족하다").

## 3. 레이아웃 구조 (컴포넌트 트리)

```
<ConsoleShell>                 // 초록 셸, max-width 420, height 100dvh
 ├ <Bezel>                     // #10150e, radius 8/8/34/8 (우하단 34 = GB 시그니처)
 │  ├ <BezelTop>               // silk "APOCALYPSE" · <BloodLed> · <DmgSwitch>
 │  └ <LcdScreen>              // border 2px #000, 스캔라인 ::after(z10)
 │     ├ <GameCanvas>          // PixiJS, 내부 320×180, width 100%, pixelated
 │     ├ <HudStrip>            // 스테이지 num · G num · <GbBar blood>
 │     └ <MenuPanel ×3>        // absolute inset:0 z6 — LCD "전체"를 덮는 GB 메뉴
 ├ <Deck>                      // 물리 버튼 영역
 │  ├ <TabButton ×3>           // STAT/GEAR/ALTAR
 │  └ <PillButton ×2>          // SELECT(소환)/START(도전), -18deg
 └ <Popup ×3>                  // console 기준 absolute inset:0 z20 (스캔라인 미적용)
```

## 4. 셸·하드웨어 컴포넌트

- **ConsoleShell**: bg --shell, 좌우 2px --shell-lo 보더, 최상단 1줄 --shell-hi 하이라이트.
  우하단 스피커 그릴: 3×30px 슬릿 6개, gap 5, rotate(-65deg).
- **BloodLed**: 7px 원. 평시 #3a1216. **피 게이지 만충 시 .on**: --blood + 글로우 +
  `blink 1.2s steps(2)` 점멸. (장식이 아니라 상태 표시기 — core의 피 게이지 상태 구독)
- **DmgSwitch**: 실크 톤 1px 보더 토글. ON 시 #9bbc0f. 동작: **게임 캔버스의 팔레트만**
  DMG 5톤으로 스왑(렌더러의 팔레트 교체 기능 재사용). UI 패널은 불변.
- **TabButton(.pbtn)**: 42px 원형, 눌림 = inset 그림자 + 어두운 배경, **활성 = 눌린 상태
  유지 + outline 2px --light(offset -6px)**. 아래 8px 실크 라벨.
- **PillButton**: 44×13px 알약, 묶음을 -18deg 회전. SELECT = ALTAR 패널 열기,
  START = 도전 시작(목업에선 실패 팝업 데모).

## 5. LCD·GB 메뉴 컴포넌트

- **스캔라인**: `repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px)`
  — LCD 전체 ::after, pointer-events none, z10.
- **Win(GB 창)**: `border:2px solid --light` + `box-shadow:inset 0 0 0 2px --ink`
  (이중 테두리), bg --bg, padding 10/10/8. **제목(.win-t)은 테두리에 걸쳐 띄움**:
  absolute top:-8px left:8px, bg --bg, 9px, letter-spacing .25em.
- **MenuItem(.mi)**: flex 행, 12px, padding 4px 2px. 이름 — **점선 리더(.dots:
  flex:1, border-bottom 1px dotted --mid, translateY(-3px))** — 값(.v bold).
- **커서(.cur)**: "▶" --light, `curblink 1s steps(2)` 점멸. 행의 기본 액션 표시.
- **InverseVideo(.inv-vid)**: 주요 액션 = 역상. bg --light, color --ink, bold,
  letter-spacing .15em, :active 시 --mid. (예: ▶ REBIRTH, ▶ SUMMON)
- **GbBar(세그먼트 게이지)**: 외곽 1px --light, 내부 padding 1px, 채움 =
  `repeating-linear-gradient(90deg, [색] 0 4px, --ink 4px 5px)` — 4px 셀 + 1px 칸막이.
  변형: blood(기본 --blood) / .xp(--accent). 부드러운 단색 바 금지.
- **Cell/Slot(장비 칸)**: bg --ink, **테두리 색 = 등급색**(1px). 슬롯은 aspect 1.3,
  인벤 셀은 1:1. 아이콘은 11×11 ASCII 코드 생성(목업의 ICONS 데이터 그대로 사용).
- **RelicCard**: 3열 그리드. 상태 3종 — 장착(테두리 --light) / 보유(--line) /
  미발견(opacity .4, 이름·별 모두 `?`). 3★ 잠금은 하단 `3★` --blood 7px.

## 6. 패널 3종 구성 (전체화면 메뉴 — 스크롤 금지)

모든 패널: absolute inset:0, **LCD 전체를 덮음**(게임은 뒤에서 계속 진행), 첫 줄은
공통 상태바(.statbar — 좌/중/우 핵심 수치), 이후 Win 2~3개. overflow:hidden —
내용이 넘치면 스크롤이 아니라 설계를 고친다. max-height 640px 이하 화면은
미디어 쿼리로 패딩·폰트 축소(목업 값 그대로).

- **STAT**: 상태바(LV/CP/G) → Win STATUS(EXP GbBar, ATK/DEF/HP/REG 행 + [+] 24×22
  박스(.pbox), PT 행 + 프리셋 ATK·BAL·VIT·MAN) → Win REBIRTH(배율 ×N + RUN 회차 +
  ▶ REBIRTH 역상) → Win RECORD(LV/CP/RE 3행).
- **GEAR**: 상태바(LV/가방 수/G) → Win EQUIP(슬롯 4) → Win BAG(6열 인벤 그리드 +
  CUBE/SELL/AUTO 행) → Win SHOP(6칸 매물 + 타이머·RENEW 행).
- **ALTAR**: 상태바(BLOOD/수치/RITE 횟수) → Win ALTAR(GbBar 풀폭 + ▶ SUMMON 역상 +
  PICK n/5) → Win RELIC(장착 유물명(.kr) + ★ + 효과 2줄, 다음 ★은 `?`) →
  Win CODEX(유물 카드 3×2).

## 7. 팝업 3종 (GB 창 + ▶ 메뉴)

공통: .pop = Win과 동일한 이중 테두리 + `4px 4px 0 #000` 하드 섀도, max-width 310.
배경 탭 = 닫기. 액션은 버튼이 아니라 **▶ 메뉴 리스트**(첫 항목에 커서).
- **장비 비교**: 좌(장착) 우(후보) 카드 — 등급색 테두리, 행: ATK(base, 점선 구분)
  /CRI/CRD/SPD/DMG + **SIN 행은 --blood**. 항목별 ▲(--accent)/▼(--blood).
  중앙 CP 증감 `+N%`. 메뉴: ▶ EQUIP / REROLL …골드 / SELL.
- **도전 실패**: 보이스 라인 1줄(.kr --blood, "화력이 부족하다"/"버티지 못했다") +
  메뉴: ▶ GO {추천 사냥터} / STAY.
- **복귀 정산**: 행 5개(시간/G/EXP/LOOT n ●등급/BLOOD MAX) 점선 구분 →
  보이스 "제단이 깨어났다."(--blood) → ▶ CLAIM.

## 8. 상호작용·상태 바인딩

- **토글**: 같은 탭 버튼 재누름 = 닫기(게임 화면 복귀). 다른 탭 = 전환.
  목업 로직 그대로: `cur=(cur===t)?null:t`.
- SELECT: ALTAR가 닫혀 있으면 연다(열려 있으면 유지). START: 도전 실행.
- 바인딩 표(core 상태 ↔ 표시): 레벨/EXP%→STAT, 스탯 4종(+분배 가능 PT)→.mi 값,
  환생 배율·회차→REBIRTH, 기록 3종→RECORD, 골드→HUD·상태바, 피 게이지→HUD GbBar +
  ALTAR GbBar + **BloodLed.on**, 인벤·장착·등급→Cell 테두리, 유물 보유·★·장착·잠금→
  RelicCard 상태, 상점 매물·타이머→SHOP, 더미 점수 증감→비교 팝업 CP 행.

## 9. 외형 선택 (목업 v5에 없는 추가 화면 — 이 절이 목업보다 우선)

- **첫 실행**: LCD 전체 GB 메뉴 1장 — Win "SURVIVOR" 안에 5종 스프라이트 가로 나열
  (idle bob), 하단에 현재 선택 이름(.kr) + 역상 `▶ PICK`. 탭/커서로 이동. 설명 텍스트 없음.
- **변경**: STAT 패널 STATUS 창 좌상단에 현재 외형 미니 스프라이트(idle) 상시 표시,
  탭 시 위 선택 화면 재진입. 변경은 즉시·무료(순수 외형).
- 데이터: data/sprites/survivors.ts 의 SURVIVOR_SKINS. 저장 키: skinId.

## 10. 금지 사항

LCD 내부 border-radius 금지(셸 하드웨어만 허용) · 블러 섀도/그라데이션 금지
(스캔라인·세그먼트의 하드스톱 repeating-gradient만 예외) · 스크롤 금지 ·
설명 텍스트 금지 · 부드러운 단색 게이지 금지 · 등급색 외 신규 색상 금지.
