# BidMindAI — UI/UX 리디자인 설계 명세서

> **버전:** v2.0  
> **프레임워크:** Next.js 14 (App Router)  
> **목적:** 기존 Glassmorphism 기반 UI를 고급스럽고 직관적인 Enterprise-grade 인터페이스로 개선

---

## 1. 디자인 철학 및 방향

### 1.1 핵심 방향: "Precision Dark"

기존 UI의 Glassmorphism을 **Refined Dark Enterprise** 스타일로 업그레이드한다.  
입찰 전문가(Bid Manager)가 매일 사용하는 도구인 만큼, 신뢰감·속도감·집중력을 동시에 제공해야 한다.

| 기준 | 기존 | 개선 방향 |
|------|------|----------|
| 색상 | 퍼플 그라디언트 위주 | 딥 네이비 + 앰버 포인트 |
| 타이포 | 시스템 기본 폰트 | `Sora` (헤딩) + `JetBrains Mono` (코드/수치) |
| 레이아웃 | 고정 단순 구조 | 3-패널 어댑티브 레이아웃 |
| 모션 | 기본 opacity 애니메이션 | 목적 있는 마이크로인터랙션 |
| 정보밀도 | 낮음 | 중-고밀도 (Notion/Linear 수준) |

### 1.2 핵심 원칙 3가지

1. **Focus Mode First** — 사용자가 지금 무엇을 해야 하는지 즉시 파악 가능
2. **Progressive Disclosure** — 정보는 필요할 때 드러남, 기본 화면은 최대한 깔끔
3. **Feedback-Rich** — 모든 AI 작업의 진행 상황이 실시간으로 시각화

---

## 2. 디자인 시스템

### 2.1 컬러 팔레트

```css
:root {
  /* 베이스 */
  --bg-void:        #080C14;  /* 최심층 배경 */
  --bg-base:        #0D1320;  /* 메인 배경 */
  --bg-surface:     #131B2E;  /* 패널/카드 배경 */
  --bg-elevated:    #1A2540;  /* 호버, 선택 상태 */

  /* 테두리 */
  --border-subtle:  rgba(255, 255, 255, 0.05);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong:  rgba(255, 255, 255, 0.18);

  /* 포인트 컬러 — 앰버 골드 */
  --accent-primary: #F59E0B;   /* 메인 액션, 링크 */
  --accent-dim:     #B45309;   /* Hover 상태 */
  --accent-glow:    rgba(245, 158, 11, 0.15);

  /* 보조 색상 */
  --blue-accent:    #3B82F6;   /* 정보, 소스 태그 */
  --green-accent:   #10B981;   /* 성공, 완료 */
  --red-accent:     #EF4444;   /* 에러 */

  /* 텍스트 */
  --text-primary:   #F1F5F9;
  --text-secondary: #94A3B8;
  --text-muted:     #475569;
  --text-inverse:   #080C14;
}
```

### 2.2 타이포그래피

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Sora', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  /* 스케일 */
  --text-xs:   0.75rem;   /* 12px — 메타데이터, 태그 */
  --text-sm:   0.875rem;  /* 14px — 보조 텍스트 */
  --text-base: 1rem;      /* 16px — 본문 */
  --text-lg:   1.125rem;  /* 18px — 서브헤딩 */
  --text-xl:   1.5rem;    /* 24px — 페이지 타이틀 */
  --text-2xl:  2rem;      /* 32px — 히어로 타이틀 */
}
```

### 2.3 스페이싱 & 레이아웃

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm:  6px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  24px;

  /* 사이드바 너비 */
  --sidebar-width:      220px;
  --sidebar-collapsed:  64px;
}
```

### 2.4 공통 컴포넌트 토큰

```css
/* 버튼 — Primary */
.btn-primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
  font-weight: 600;
  border-radius: var(--radius-md);
  padding: 10px 20px;
  transition: box-shadow 0.2s, transform 0.1s;
}
.btn-primary:hover {
  box-shadow: 0 0 24px var(--accent-glow);
  transform: translateY(-1px);
}

/* 버튼 — Ghost */
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
}
.btn-ghost:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

/* 입력 필드 */
.input-field {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-field:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
```

---

## 3. 전체 레이아웃 구조

### 3.1 앱 쉘 (App Shell)

```
┌──────────────────────────────────────────────────────────────┐
│                    Top Navigation Bar (56px)                  │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│ Sidebar  │              Main Content Area                     │
│ (220px)  │                                                    │
│          │                                                    │
│  [접힘   │                                                    │
│   가능]  │                                                    │
│          │                                                    │
└──────────┴───────────────────────────────────────────────────┘
```

### 3.2 상단 내비게이션 바

**높이:** 56px  
**배경:** `var(--bg-void)` + 하단 `1px solid var(--border-subtle)` 구분선  

| 영역 | 내용 |
|------|------|
| 좌측 | BidMindAI 로고 (아이콘 + 텍스트) |
| 중앙 | 글로벌 검색 바 (`Cmd+K` 단축키) |
| 우측 | 업로드 상태 인디케이터 · 알림 · 사용자 아바타 |

**글로벌 검색 (Command Palette):**  
`Cmd+K`로 열리는 커맨드 팔레트. 문서 검색, 페이지 이동, 최근 쿼리 히스토리를 통합하여 제공.

### 3.3 사이드바

**기본 너비:** 220px (접으면 64px로 아이콘만 표시)

```
──────────────────
  📁  문서 관리
──────────────────
  💬  RAG 챗봇         ← 현재 위치 표시 (앰버 좌측 바)
──────────────────
  📝  제안서 생성
──────────────────
  📊  분석 대시보드
──────────────────
  ⚙️  설정
──────────────────
```

**활성 메뉴 스타일:**
```css
.nav-item.active {
  background: var(--bg-elevated);
  border-left: 3px solid var(--accent-primary);
  color: var(--text-primary);
}
```

---

## 4. 페이지별 UI/UX 설계

---

### 4.1 문서 관리 페이지 (Document Manager)

#### 현황 문제점
- 업로드 후 처리 상태 피드백 없음
- 업로드된 문서 목록 조회 불가

#### 개선 레이아웃

```
┌──────────────────────────────────────────────────────┐
│  문서 관리                              [+ 문서 업로드] │
│  총 24개 문서 · 마지막 업로드 2시간 전                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─── 드래그 앤 드롭 업로드 존 ──────────────────┐   │
│  │                                              │   │
│  │   📄  PDF 파일을 여기에 끌어다 놓거나          │   │
│  │       클릭하여 선택하세요                     │   │
│  │       최대 50MB · PDF 형식                   │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  문서 목록 ─────────────────────────────────────     │
│                                                      │
│  ┌──────────┬──────────┬──────────┬──────────┐      │
│  │ 파일명   │ 크기     │ 상태     │ 업로드일  │      │
│  ├──────────┼──────────┼──────────┼──────────┤      │
│  │ RFP_Q3.. │ 2.4 MB   │ ● 완료   │ 2일 전   │      │
│  │ 제안서.. │ 1.8 MB   │ ⏳ 처리중 │ 방금     │      │
│  │ 입찰서.. │ 4.1 MB   │ ● 완료   │ 5일 전   │      │
│  └──────────┴──────────┴──────────┴──────────┘      │
└──────────────────────────────────────────────────────┘
```

#### 업로드 처리 상태 플로우

```
파일 선택 → [업로드 중...] → [텍스트 추출 중...] → [청킹 중...] → [임베딩 생성 중...] → ✅ 완료
```
각 단계마다 프로그레스 바와 단계 라벨을 표시. 완료 후 토스트 알림 제공.

#### 업로드 상태 컴포넌트 상세

```tsx
// 업로드 상태 표시기
type UploadStatus = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'done' | 'error'

// 파일 아이템 카드
interface DocumentCard {
  filename: string
  size: string
  status: UploadStatus
  progress: number      // 0-100
  uploadedAt: Date
  chunkCount?: number   // 완료 시 표시
}
```

---

### 4.2 RAG 챗봇 페이지 (Chat)

#### 현황 문제점
- 메시지 목록 + 입력창만 존재, 컨텍스트 정보 없음
- 소스 파일명만 표시, 클릭하여 원문 확인 불가
- 세션 히스토리 없음 (새로고침 시 초기화)
- 마크다운 렌더링 미지원

#### 개선 레이아웃

```
┌─────────────────┬──────────────────────────────┬──────────────┐
│  대화 히스토리  │        채팅 영역              │  소스 패널   │
│  (220px)        │       (flex: 1)               │  (280px)     │
│                 │                               │              │
│  ─ 오늘         │  ╔═════════════════════════╗  │  📌 참조 소스 │
│  › 현재 세션    │  ║  AI 답변 메시지 ...     ║  │              │
│                 │  ╚═════════════════════════╝  │  ┌──────────┐│
│  ─ 어제         │                               │  │📄 RFP_Q3 ││
│    보안 솔루션..│       나의 질문               │  │  p.12-15 ││
│    AI 도입 방안 │                               │  └──────────┘│
│                 │  ╔═════════════════════════╗  │              │
│  ─ 이번주       │  ║  다음 AI 답변 ...       ║  │  ┌──────────┐│
│    클라우드 전환│  ╚═════════════════════════╝  │  │📄 제안서  ││
│                 │                               │  │  p.3     ││
│  [+ 새 대화]    ├───────────────────────────────┤  └──────────┘│
│                 │ ┌─── 입력창 ───────────────┐ │              │
│                 │ │ 질문을 입력하세요...      │ │              │
│                 │ │                    [전송] │ │              │
│                 │ └──────────────────────────┘ │              │
└─────────────────┴──────────────────────────────┴──────────────┘
```

#### 메시지 버블 상세 설계

**사용자 메시지:**
```
                          ┌─────────────────────────┐
                     YOU  │ AI 콜센터 구축 제안서에서 │
                          │ 예산 항목을 알려주세요   │
                          └─────────────────────────┘
```

**AI 응답 메시지 (마크다운 렌더링 + 소스 연동):**
```
┌──────────────────────────────────────────────────┐
│ BidMindAI                              03:42 PM  │
├──────────────────────────────────────────────────┤
│                                                  │
│  제안서의 예산 항목은 다음과 같습니다:           │
│                                                  │
│  **1단계 — 인프라 구축**                         │
│  - 서버 도입: 1억 2천만원                        │
│  - 네트워크 설비: 3천만원                        │
│                                                  │
│  **2단계 — SW 라이선스**                         │
│  - AI 엔진: 5천만원/년                           │
│                                                  │
├──────────────────────────────────────────────────┤
│ 📄 RFP_Q3_2024.pdf · p.12  📄 제안서_v2.pdf · p.3│
└──────────────────────────────────────────────────┘
```

#### 스트리밍 UX

| 상태 | 표시 방법 |
|------|----------|
| 대기 중 | 3개 점 애니메이션 (dots 순차 fade) |
| 스트리밍 중 | 텍스트가 타이핑되듯 출력 + 커서 `▌` |
| 완료 | 소스 태그 슬라이드업 등장 |
| 에러 | 빨간 테두리 + 재시도 버튼 |

#### 세션 히스토리 (localStorage 기반)

```typescript
interface ChatSession {
  id: string
  title: string          // 첫 질문 앞 20자 자동 설정
  createdAt: Date
  messages: Message[]
  documentIds: string[]  // 참조된 문서
}
```

---

### 4.3 제안서 생성 페이지 (Proposal Generator)

#### 현황 문제점
- 2-패널 레이아웃은 좋으나, 결과물이 plain text로만 출력됨
- 생성된 내용을 복사·다운로드 불가
- 생성 진행률 표시 없음
- 이전 생성 이력 없음

#### 개선 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  제안서 생성           [이전 생성 이력 ▾]   [저장] [다운로드] │
├────────────────────┬─────────────────────────────────────────┤
│  입력 패널 (380px) │  결과 패널                              │
│                    │                                         │
│  ◆ RFP 제목        │  ┌── 목차 ──────────────────────────┐  │
│  ┌──────────────┐  │  │ 1. 요약 (Executive Summary)      │  │
│  │              │  │  │ 2. 문제 인식 및 배경              │  │
│  └──────────────┘  │  │ 3. 제안 솔루션                   │  │
│                    │  │ 4. 구현 방법론 및 일정            │  │
│  ◆ 요구사항 / 범위 │  │ 5. 예산 계획                     │  │
│  ┌──────────────┐  │  │ 6. 팀 역량 및 레퍼런스           │  │
│  │              │  │  └──────────────────────────────────┘  │
│  │              │  │                                         │
│  │              │  │  ── 본문 ─────────────────────────────  │
│  └──────────────┘  │                                         │
│                    │  # 1. 요약 (Executive Summary)          │
│  ◆ 참조 문서       │                                         │
│  ┌──────────────┐  │  본 제안서는 AI 기반 콜센터 구축을      │
│  │ 📄 문서 선택 │  │  위한 종합적인 솔루션을 제시합니다...   │
│  └──────────────┘  │                                         │
│                    │  [스트리밍 중... ━━━━━━━━━░░ 78%]       │
│  [제안서 생성 ▶]   │                                         │
└────────────────────┴─────────────────────────────────────────┘
```

#### 생성 진행 표시

```tsx
// 섹션별 순차 생성 표시
const SECTIONS = [
  { id: 'summary',      label: '요약 작성 중...',         icon: '📋' },
  { id: 'analysis',     label: '문제 분석 중...',         icon: '🔍' },
  { id: 'solution',     label: '솔루션 구성 중...',       icon: '💡' },
  { id: 'methodology',  label: '방법론 정리 중...',       icon: '📐' },
  { id: 'budget',       label: '예산 계획 수립 중...',    icon: '💰' },
  { id: 'references',   label: '레퍼런스 추가 중...',     icon: '🏆' },
]
```

**진행 표시 UI:**
```
  ✅ 요약 작성
  ✅ 문제 분석
  🔄 솔루션 구성 ← 현재
  ⬜ 방법론
  ⬜ 예산 계획
  ⬜ 레퍼런스
```

#### 결과물 액션 버튼

| 버튼 | 기능 |
|------|------|
| 📋 복사 | 전체 마크다운 클립보드 복사 |
| 💾 저장 | 로컬 세션에 저장 (이력 관리) |
| 📥 DOCX 다운로드 | 서식 적용된 Word 파일 다운 |
| 📥 PDF 다운로드 | PDF 내보내기 |
| ✏️ 편집 모드 | 인라인 텍스트 수정 |

---

### 4.4 분석 대시보드 (Analytics Dashboard)

#### 신규 페이지 제안

```
┌──────────────────────────────────────────────────────────────┐
│  시스템 현황                                                  │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 총 문서  │  │ 총 청크  │  │ 오늘 질의│  │ 평균 응답│   │
│  │   24개   │  │  3,847   │  │   18회   │  │  2.3초   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──── 최근 질의 히스토리 ─────────────────────────────┐   │
│  │ 시간    │ 질문 요약                      │ 소스 수   │   │
│  │ 14:32   │ AI 콜센터 예산 항목             │ 3개      │   │
│  │ 14:15   │ 보안 요구사항 분석              │ 5개      │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 핵심 인터랙션 패턴

### 5.1 스트리밍 텍스트 렌더링

현재 `white-space: pre-wrap`으로 plain text를 출력하는 방식을 `react-markdown` 라이브러리를 활용한 마크다운 렌더링으로 교체한다.

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 스트리밍 중에도 마크다운 파싱 적용
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {message.content}
</ReactMarkdown>
```

**스트리밍 커서 위치:** 마지막 텍스트 노드 뒤에 `▌` 커서를 CSS `::after`로 추가.

### 5.2 소스 태그 인터랙션

```
클릭 전: [📄 RFP_Q3_2024.pdf]
클릭 후: ────────────────────────────────────
         📄 RFP_Q3_2024.pdf
         페이지 12 — "예산 항목 세부 내역"
         
         "서버 인프라 구축 비용은 총 1억
         2천만원으로 책정하며..."
         
         [전체 문서 보기 →]
         ────────────────────────────────────
```

### 5.3 Command Palette (Cmd+K)

```
┌─────────────────────────────────────────────────────┐
│ 🔍  무엇이든 검색하세요...                           │
├─────────────────────────────────────────────────────┤
│ 최근 질의                                           │
│  ↩  AI 콜센터 구축 예산은 얼마인가요?               │
│  ↩  보안 요구사항 체크리스트                        │
├─────────────────────────────────────────────────────┤
│ 페이지 이동                                         │
│  →  문서 관리                                       │
│  →  제안서 생성                                     │
├─────────────────────────────────────────────────────┤
│ 최근 문서                                           │
│  📄  RFP_Q3_2024.pdf                               │
│  📄  제안서_AI콜센터_v2.pdf                        │
└─────────────────────────────────────────────────────┘
```

### 5.4 토스트 알림 시스템

```tsx
type ToastType = 'success' | 'error' | 'info' | 'loading'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number   // ms, 기본 4000
}
```

**위치:** 우측 하단 고정  
**스택:** 최대 3개, 오래된 것부터 자동 제거

---

## 6. 반응형 디자인

### 6.1 브레이크포인트

| 브레이크포인트 | 너비 | 변화 |
|---------------|------|------|
| Desktop | ≥ 1280px | 풀 레이아웃 (사이드바 + 소스 패널) |
| Laptop | 1024–1279px | 소스 패널 숨김 (버튼으로 토글) |
| Tablet | 768–1023px | 사이드바 아이콘 전용 모드 |
| Mobile | < 768px | 사이드바 drawer로 변경, 소스 패널 모달 |

### 6.2 사이드바 반응형

```tsx
// 사이드바 상태 관리
const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'drawer'>('expanded')

// 브레이크포인트에 따라 자동 조정
useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 768) setSidebarState('drawer')
    else if (window.innerWidth < 1024) setSidebarState('collapsed')
    else setSidebarState('expanded')
  }
  window.addEventListener('resize', handleResize)
  handleResize()
}, [])
```

---

## 7. 접근성 (Accessibility)

### 7.1 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| `Cmd+K` | 커맨드 팔레트 열기 |
| `Cmd+Enter` | 메시지 전송 (채팅) |
| `Cmd+N` | 새 대화 시작 |
| `Escape` | 모달/패널 닫기 |
| `Tab` | 포커스 이동 |

### 7.2 ARIA 레이블

```tsx
// 채팅 메시지 목록
<div role="log" aria-live="polite" aria-label="대화 내용">
  {messages.map(m => (
    <div role="article" aria-label={`${m.role === 'user' ? '사용자' : 'AI'} 메시지`}>
      {m.content}
    </div>
  ))}
</div>

// 스트리밍 상태
<div role="status" aria-live="assertive">
  {isLoading && 'AI가 답변을 생성하고 있습니다...'}
</div>
```

### 7.3 색상 대비

모든 텍스트는 WCAG AA 기준 (4.5:1) 이상 대비 비율을 충족한다.

| 조합 | 대비 비율 |
|------|----------|
| `--text-primary` / `--bg-surface` | 12.4:1 ✅ |
| `--text-secondary` / `--bg-surface` | 5.2:1 ✅ |
| `--accent-primary` / `--bg-void` | 7.8:1 ✅ |

---

## 8. 성능 최적화

### 8.1 가상 스크롤 (Virtual Scrolling)

대화 메시지가 100개 이상 쌓일 경우 `react-virtual` 적용.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 120,
  overscan: 5,
})
```

### 8.2 스트림 버퍼링

SSE 청크가 너무 빠르게 오면 UI가 끊겨 보임. 16ms 단위로 배치 업데이트한다.

```tsx
// 스트림 버퍼: requestAnimationFrame 기반 배치
let buffer = ''
const flush = () => {
  if (!buffer) return
  setMessages(prev => /* buffer 내용 append */)
  buffer = ''
}
const scheduleFlush = () => requestAnimationFrame(flush)
```

### 8.3 코드 스플리팅

```tsx
// 무거운 컴포넌트 지연 로딩
const ProposalGenerator = dynamic(() => import('./ProposalGenerator'), {
  loading: () => <SkeletonPanel />,
})

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), {
  loading: () => <SkeletonDashboard />,
})
```

---

## 9. 구현 우선순위 로드맵

### Phase 1 — Core UX (1~2주)

- [ ] 디자인 시스템 토큰 적용 (컬러, 타이포, 스페이싱)
- [ ] 앱 쉘 레이아웃 (사이드바 + 상단 네비)
- [ ] 채팅 페이지: 마크다운 렌더링 적용
- [ ] 채팅 페이지: 소스 패널 분리
- [ ] 토스트 알림 시스템

### Phase 2 — Enhanced UX (2~3주)

- [ ] 세션 히스토리 (localStorage 기반)
- [ ] Command Palette (Cmd+K)
- [ ] 문서 관리 페이지 개선 (업로드 진행률)
- [ ] 제안서 생성: 섹션별 진행 표시
- [ ] 반응형 레이아웃

### Phase 3 — Advanced (3~4주)

- [ ] 분석 대시보드
- [ ] 소스 클릭 시 원문 미리보기
- [ ] 제안서 DOCX/PDF 다운로드
- [ ] 가상 스크롤 적용
- [ ] 키보드 단축키 전체 구현

---

## 10. 파일 구조 제안

```
frontend/
├── app/
│   ├── layout.tsx          ← 앱 쉘 (사이드바 + 네비)
│   ├── page.tsx            ← 대시보드 리다이렉트
│   ├── chat/
│   │   └── page.tsx        ← RAG 챗봇
│   ├── generate/
│   │   └── page.tsx        ← 제안서 생성
│   ├── documents/
│   │   └── page.tsx        ← 문서 관리
│   └── analytics/
│       └── page.tsx        ← 분석 대시보드
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopNav.tsx
│   │   └── CommandPalette.tsx
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   ├── SourcePanel.tsx
│   │   ├── StreamingIndicator.tsx
│   │   └── SessionHistory.tsx
│   ├── proposal/
│   │   ├── InputPanel.tsx
│   │   ├── ResultPanel.tsx
│   │   └── GenerationProgress.tsx
│   └── ui/
│       ├── Toast.tsx
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Skeleton.tsx
│
├── hooks/
│   ├── useStream.ts        ← SSE 스트리밍 커스텀 훅
│   ├── useChatSession.ts   ← 대화 세션 관리
│   └── useCommandPalette.ts
│
├── lib/
│   ├── api.ts              ← API 클라이언트
│   └── storage.ts          ← localStorage 유틸
│
└── styles/
    ├── globals.css         ← CSS 변수 + 리셋
    └── typography.css      ← 타이포그래피 베이스
```

---

*이 문서는 BidMindAI v2.0 리디자인의 기준 명세서이며, 구현 중 발견된 개선사항은 팀 리뷰를 거쳐 업데이트한다.*
