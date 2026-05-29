# ETF Momentum — 전략 신호 UI 설계

**날짜:** 2026-05-29  
**상태:** 승인됨

---

## 개요

현재 ETF Momentum Dashboard에 퀀트 매매 전략 신호를 시각화하는 기능을 추가한다. 기존 하단 ScoreBreakdownBar를 포트폴리오 상태 바(PortfolioStatusBar)로 교체하여, 사용자가 현재 보유 상태와 이번 달 액션을 한눈에 파악할 수 있게 한다.

---

## 전략 규칙 (Strategy Rules)

### 포트폴리오 구성
- 보유 ETF 수: **Top 3**
- 현재 Top 3을 항상 보유 중으로 가정 (자동 가정 방식, 수동 입력 없음)

### 편입 조건 (둘 다 충족)
1. 현재 랭킹 **Top 3** 이내
2. `total_score > 0` (절대 모멘텀 양수)

### 청산 조건 (하나라도 해당)
1. 랭킹이 **7위 이하**로 이탈 (버퍼 존: 4~6위는 유지)
2. `total_score ≤ 0` (절대 모멘텀 음수 전환)

### 리밸런싱 주기
- **월 1회** — 매월 마지막 영업일에만 포트폴리오 검토
- 중간 랭킹 변화는 무시 (노이즈 차단)

### 상태 정의

| 상태 | 조건 | 색상 |
|------|------|------|
| `HOLD` | 보유 중, Top 3, score > 0 | 초록 |
| `BUFFER` | 보유 중, 4~6위 (버퍼존) | 노랑 |
| `SELL` | 보유 중, 7위↓ 또는 score ≤ 0 | 빨강 |
| `대기` | 미보유, Top 10 이내 진입 후보 | 회색 |

---

## UI 변경 사항

### 제거
- `ScoreBreakdownBar` 컴포넌트 (하단 110px 영역)

### 추가
- `PortfolioStatusBar` 컴포넌트 (동일 110px 영역 교체)

### PortfolioStatusBar 구성 (좌 → 우)

```
[Portfolio 레이블] | [보유 ETF 3개] | [이번 달 액션 박스] | [전략 기준 요약]
```

**보유 ETF 섹션**: 각 보유 종목마다
- 심볼 (크게, 색상 강조)
- 현재 랭킹 + total_score
- 상태 태그 (HOLD / BUFFER / SELL)

**이번 달 액션 박스**: 상태에 따라 두 가지 모드
- 정상: "변동 없음 ✓" + "다음 체크: MM월 DD일" (파랑/중립)
- 경고: "종목 주시 ⚠" + "7위↓ 시 XXX으로 교체" (노랑/경고)
- 청산: "XXX 매도 신호" + "XXX 편입 예정" (빨강/강조)

**전략 기준 요약**: 우측 고정 텍스트
- 보유: Top 3
- 청산: 7위↓ or score < 0
- 주기: 월 1회 체크

### 랭킹 테이블 변경
- 각 행에 상태 태그 컬럼 추가
  - 보유 중 ETF: `HOLD` / `BUFFER` / `SELL` 태그 표시
  - Top 10 진입 후보: `대기` 태그 표시
  - 나머지: 태그 없음

---

## 데이터 흐름

```
LatestRanking[] (API)
  ↓
computePortfolioStatus(data) → PortfolioState
  ├── holdings: ETF[] (Top 3, score > 0)
  ├── bufferZone: ETF[] (4~6위 중 보유 중인 것)
  ├── sellSignals: ETF[] (7위↓ 또는 score ≤ 0)
  ├── actionRequired: boolean
  └── nextCheckDate: string (이번 달 마지막 영업일)

PortfolioState → PortfolioStatusBar (하단 바)
PortfolioState → RankingTable (태그 렌더링)
```

`computePortfolioStatus`는 순수 함수로 `lib/strategy.ts`에 분리 구현.

---

## 파일 구조 변경

```
app/components/
  PortfolioStatusBar.tsx   ← 신규 (ScoreBreakdownBar 교체)
  RankingTable.tsx         ← 수정 (상태 태그 컬럼 추가)

lib/
  strategy.ts              ← 신규 (computePortfolioStatus 순수 함수)
  types.ts                 ← 수정 (PortfolioState 타입 추가)

app/page.tsx               ← 수정 (ScoreBreakdownBar → PortfolioStatusBar)
```

---

## 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| Top 3 중 score ≤ 0인 종목 있음 | 해당 종목 SELL 신호, 다음 양수 score 종목으로 교체 후보 표시 |
| 전체 시장 약세 (Top 3 모두 score ≤ 0) | "현금 보유 권장" 메시지 표시 |
| 보유 ETF가 7위↓ + 새 후보 없음 (score > 0 ETF 부족) | 해당 자리 현금으로 표시 |
| 데이터 로딩 중 | 기존 스켈레톤 처리 유지 |

---

## 비고

- `ScoreBreakdownBar` (ETF 클릭 시 기간별 스코어 차트)는 제거. 해당 정보는 랭킹 테이블의 행 클릭 → 툴팁 또는 별도 확장으로 추후 고려 가능.
- 전략 파라미터 (Top N, 버퍼 임계값, score 기준값)는 현재 하드코딩. 향후 설정 UI 추가 가능.
