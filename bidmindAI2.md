
---

# PDF RAG 챗봇  · 제안서 생성 시스템

## 최종 보완판 v3.0

### Gemini 전체 스택 기반

**작성일: 2026년 3월 17일**

---

## 0. 프로젝트 개요

| 항목           | 내용                                    |
| ------------ | ------------------------------------- |
| 임베딩 모델       | `gemini-embedding-2-preview` (3,072d) |
| 제안서 생성       | `Gemini 2.5 Pro`                      |
| 챗봇 대화        | `Gemini 2.5 Flash`                    |
| 경량 태깅 / HyDE | `Gemini 2.5 Flash-Lite`               |
| Vector DB    | `Qdrant` (HNSW m=32)                  |
| 백엔드          | `FastAPI` · `Python 3.12`             |
| 프론트엔드        | `Next.js 14` · `TypeScript`           |
| 대상 문서        | 대량 문서                              |
| 개발 기간        | 5개월 (Sprint 1~8)                      |

---

# 1. 프로젝트 목표

본 프로젝트는 **대량 문서를 기반으로 IT 제안서를 자동 생성하는 RAG 챗봇 플랫폼**을 구축하는 것을 목표로 합니다.

## 핵심 목표

1. PDF 업로드 · 파싱 · 청킹 · 임베딩 · Qdrant 인덱싱
2. Dense + BM25 하이브리드 검색

   * HyDE
   * RRF
   * Cross-Encoder 3단계 검색
3. 챗봇 질의응답

   * `Gemini 2.5 Flash`
   * 멀티턴 대화
   * SSE 스트리밍
4. 제안서 섹션별 자동 생성

   * `Gemini 2.5 Pro`
   * 1M 컨텍스트 활용
5. DOCX/PDF 출력 · 에디터 UI · 관리자 기능 · 보안/모니터링

---

# 2. 확정 기술 스택

## 2.1 AI / RAG 모델 역할 분담

| 모델                           | 역할           |   컨텍스트 |    입력 단가 |     출력 단가 |
| ---------------------------- | ------------ | -----: | -------: | --------: |
| `gemini-2.5-pro`             | 제안서 전체 생성    |  1M 토큰 | $1.25/1M | $10.00/1M |
| `gemini-2.5-flash`           | 챗봇 멀티턴 대화    |  1M 토큰 | $0.30/1M |  $2.50/1M |
| `gemini-2.5-flash-lite`      | HyDE · 메타 태깅 |   128K | $0.10/1M |  $0.40/1M |
| `gemini-embedding-2-preview` | 벡터 임베딩       | 8,192t | $0.20/1M |         - |

> **주의**
>
> * AI 코딩툴 사용 시 반드시 Google AI 공식 문서에서 **정확한 모델 ID**를 확인한 뒤 하드코딩하세요.
> * `gemini-2.5-flash-lite`는 실제 배포 시 preview suffix가 붙을 수 있으므로 **실제 API 호출 검증**이 필요합니다.

---

## 2.2 인프라 스택

| 계층          | 컴포넌트                 | 버전 / 스펙             | 비고                        |
| ----------- | -------------------- | ------------------- | ------------------------- |
| Vector DB   | Qdrant               | v1.9+ · HNSW m=32   | Dense 3072d + Sparse BM25 |
| RDBMS       | PostgreSQL           | 16                  | 문서 메타데이터                  |
| Cache       | Redis                | 7-alpine            | 임베딩 캐시 · 검색 캐시            |
| 백엔드         | FastAPI              | 0.111 · Python 3.12 | SSE 스트리밍                  |
| 프론트         | Next.js              | 14 · TypeScript     | Tiptap 에디터                |
| PDF 파싱      | PyMuPDF + pdfplumber | 1.24 / 0.11         | 스캔 PDF → Tesseract 5      |
| RAG 오케스트레이션 | LangChain            | 0.3+                | `langchain-google-genai`  |
| 개발 환경       | Docker Compose       | -                   | K8s 이관 가능 구조              |
| 모니터링        | Prometheus + Grafana | -                   | 응답시간 · API 비용 추적          |

---

# 3. 환경변수 설정 (`.env.example`)

아래 키 목록을 `.env.example`로 저장하고, 실제 값은 `.env`에 기입합니다.
`.env`는 절대 Git에 커밋하지 않습니다.

```env
# ─── Gemini AI ───────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_EMBED_MODEL=gemini-embedding-2-preview
GEMINI_PRO_MODEL=gemini-2.5-pro
GEMINI_FLASH_MODEL=gemini-2.5-flash
GEMINI_LITE_MODEL=gemini-2.5-flash-lite   # 실제 ID 확인 필수

# ─── Qdrant ──────────────────────────────────
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=proposals_3072

# ─── PostgreSQL ──────────────────────────────
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=proposals
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_password_here
DATABASE_URL=postgresql://admin:your_password_here@postgres:5432/proposals

# ─── Redis ───────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/0

# ─── App ─────────────────────────────────────
APP_ENV=development
LOG_LEVEL=INFO
SECRET_KEY=your_secret_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

---

# 4. 프로젝트 폴더 구조

```text
project-root/
├─ backend/
│  ├─ app/
│  │  ├─ main.py              # FastAPI 앱 진입점
│  │  ├─ api/                 # 라우터 (chat, generate, documents, search)
│  │  ├─ core/                # 설정 (config.py, security.py)
│  │  ├─ models/              # SQLAlchemy 모델
│  │  ├─ schemas/             # Pydantic 스키마
│  │  ├─ services/            # 비즈니스 로직
│  │  ├─ rag/                 # RAG 파이프라인
│  │  │  ├─ embedder.py       # Gemini 임베딩
│  │  │  ├─ indexer.py        # Qdrant 업서트
│  │  │  ├─ retriever.py      # 하이브리드 검색
│  │  │  ├─ reranker.py       # Cross-Encoder
│  │  │  └─ hyde.py           # HyDE 확장
│  │  ├─ pdf/                 # PDF 처리
│  │  │  ├─ parser.py         # 파싱 · 타입 감지
│  │  │  ├─ chunker.py        # 청킹
│  │  │  └─ ocr.py            # Tesseract OCR
│  │  ├─ db/                  # DB 연결 (postgres, redis, qdrant)
│  │  └─ utils/               # 로깅 · 재시도 · 비용 추적
│  ├─ requirements.txt
│  └─ Dockerfile
├─ frontend/
│  ├─ app/                    # Next.js 14 App Router
│  ├─ components/             # UI 컴포넌트
│  ├─ lib/                    # API 클라이언트 · 훅
│  └─ package.json
├─ docker-compose.yml
├─ .env
├─ .env.example
└─ README.md
```

---

# 5. MVP 개발 순서 (Sprint 1~8)

| Sprint   | 목표        | 핵심 구현                                         | 완료 기준           |
| -------- | --------- | --------------------------------------------- | --------------- |
| Sprint 1 | 인프라 기반    | Docker Compose · Qdrant/PG/Redis · health API | 컨테이너 전체 기동      |
| Sprint 2 | PDF 파이프라인 | 파싱 · 청킹 · OCR 분기 · 업로드 API                    | 대량 문서 인덱싱 완료 |
| Sprint 3 | 임베딩 인덱싱   | Gemini 임베딩 · Qdrant 업서트 · 배치 처리               | 검색 가능 상태        |
| Sprint 4 | 검색 API    | Dense · BM25 · RRF · Cross-Encoder            | Recall@5 ≥ 85%  |
| Sprint 5 | 챗봇 API    | Flash · 멀티턴 · SSE · 근거 반환                     | 실시간 스트리밍        |
| Sprint 6 | 제안서 생성    | Pro · 섹션별 프롬프트 · 스트리밍                         | 6개 섹션 생성        |
| Sprint 7 | 프론트 연결    | Next.js UI · 챗봇 · 에디터 · 다운로드                  | MVP 데모 가능       |
| Sprint 8 | 운영화       | Redis 캐시 · RBAC · 모니터링 · K8s                  | 운영 배포 완료        |

---

# 6. 구현 API 목록

| 엔드포인트                        | 메서드  | 설명               | 우선순위     |
| ---------------------------- | ---- | ---------------- | -------- |
| `/health`                    | GET  | 서비스 헬스체크         | Sprint 1 |
| `/ready`                     | GET  | 의존성 연결 확인        | Sprint 1 |
| `/api/documents/upload`      | POST | PDF 파일 업로드       | Sprint 2 |
| `/api/documents/index`       | POST | PDF 임베딩 · 인덱싱 실행 | Sprint 3 |
| `/api/documents`             | GET  | 문서 목록 조회         | Sprint 2 |
| `/api/documents/{id}`        | GET  | 문서 상세 조회         | Sprint 2 |
| `/api/search`                | POST | 하이브리드 검색         | Sprint 4 |
| `/api/chat`                  | POST | 챗봇 SSE 스트리밍      | Sprint 5 |
| `/api/generate`              | POST | 제안서 생성 SSE 스트리밍  | Sprint 6 |
| `/api/proposals/export/docx` | POST | DOCX 다운로드        | Sprint 7 |
| `/api/proposals/export/pdf`  | POST | PDF 변환 출력        | Sprint 7 |

---

# 7. 에러 시나리오 및 처리 방침

모든 외부 API 호출에는 아래 처리 방침을 반드시 적용합니다.

| 에러 상황                       | 처리 방법                                 | 구현 위치               |
| --------------------------- | ------------------------------------- | ------------------- |
| Gemini API Rate Limit (429) | 지수 백오프 재시도 (최대 5회, 초기 1초)             | `utils/retry.py`    |
| Gemini API 응답 없음 (timeout)  | 30초 타임아웃 설정 · 재시도 2회 후 사용자 알림         | `utils/retry.py`    |
| Qdrant 연결 실패                | 재시도 3회 · 실패 시 503 반환 + 로그             | `db/qdrant.py`      |
| PostgreSQL 연결 실패            | connection pool 설정 · 재시도              | `db/postgres.py`    |
| Redis 연결 실패                 | Cache miss로 처리 (graceful degradation) | `db/redis.py`       |
| PDF 파싱 실패                   | 실패 문서 별도 로그 저장 · 건너뛰고 계속 진행           | `pdf/parser.py`     |
| OCR 실패                      | 빈 텍스트 반환 · 경고 로그 · 수동 처리 대기열 이동       | `pdf/ocr.py`        |
| 임베딩 생성 실패                   | 해당 청크 스킵 · 재시도 큐에 추가                  | `rag/embedder.py`   |
| 잘못된 사용자 입력                  | Pydantic 유효성 검사 · 422 반환              | `schemas/`          |
| 프롬프트 인젝션 의심                 | 입력값 sanitize · 로그 기록 · 생성 거부          | `utils/security.py` |

---

## 7.1 재시도 유틸리티 코드 패턴

```python
import asyncio
import logging
from functools import wraps

def async_retry(max_attempts=5, base_delay=1.0, exceptions=(Exception,)):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts - 1:
                        raise
                    delay = base_delay * (2 ** attempt)
                    logging.warning(f"Retry {attempt+1}/{max_attempts}: {e}")
                    await asyncio.sleep(delay)
        return wrapper
    return decorator

# 사용 예시
@async_retry(max_attempts=5, exceptions=(RateLimitError,))
async def embed_document(text: str) -> list[float]:
    ...
```

---

# 8. 테스트 전략

## 8.1 단위 테스트 (`pytest`)

| 모듈                 | 테스트 대상                           | 목표 커버리지 |
| ------------------ | -------------------------------- | ------- |
| `pdf/parser.py`    | PDF 타입 감지 · 텍스트 추출 · 표 파싱        | 90% 이상  |
| `pdf/chunker.py`   | 청크 크기 · 오버랩 · 메타데이터 보존           | 90% 이상  |
| `rag/embedder.py`  | 임베딩 차원(3072) · task_type 분리      | 85% 이상  |
| `rag/retriever.py` | Dense/Sparse 검색 결과 구조 · score 포함 | 85% 이상  |
| `rag/hyde.py`      | HyDE 출력이 비어있지 않음                 | 80% 이상  |
| `api/chat.py`      | SSE 응답 포맷 · 히스토리 전달              | 80% 이상  |
| `api/generate.py`  | 섹션별 프롬프트 구성 · 컨텍스트 주입            | 80% 이상  |

---

## 8.2 통합 테스트 기준

1. 전체 파이프라인

   * PDF 업로드 → 임베딩 → 검색 → 챗봇 응답 E2E 동작 확인
2. RAGAS 평가셋 100개 기준

   * Recall@5 ≥ 85%
   * Faithfulness ≥ 0.80
3. SSE 스트리밍 응답

   * 첫 토큰 기준 지연 < 500ms
4. 동시 사용자 50명 기준

   * 평균 응답시간 < 3초

---

## 8.3 테스트 디렉토리 구조

```text
backend/
└─ tests/
   ├─ unit/
   │  ├─ test_parser.py
   │  ├─ test_chunker.py
   │  ├─ test_embedder.py
   │  └─ test_retriever.py
   ├─ integration/
   │  ├─ test_pipeline.py
   │  └─ test_api.py
   └─ eval/
      ├─ ragas_eval.py
      └─ eval_dataset.json
```

---

# 9. AI 코딩툴 실전 프롬프트 세트

아래 프롬프트를 Cursor / Claude Code / Windsurf / Cline에 그대로 붙여넣어 사용합니다.
각 프롬프트는 **이전 Sprint 결과물을 전제로 순차 실행**합니다.

---

## Sprint 1 · 프로젝트 골격 생성

```md
너는 시니어 풀스택 AI 엔지니어다.

아래 스펙으로 PDF RAG 챗봇 시스템의 초기 프로젝트 구조를 생성하라.

[기술스택]
- Backend: FastAPI 0.111, Python 3.12
- Frontend: Next.js 14, TypeScript
- Vector DB: Qdrant (HNSW m=32, 3072d)
- DB: PostgreSQL 16 / Redis 7
- AI: gemini-embedding-2-preview, gemini-2.5-pro,
      gemini-2.5-flash, gemini-2.5-flash-lite

[산출물]
- 전체 폴더 구조 (backend/app/{api,core,models,schemas,services,rag,pdf,db,utils})
- docker-compose.yml (qdrant, postgres, redis, api, frontend 포함)
- .env.example (GEMINI_API_KEY, QDRANT_*, POSTGRES_*, REDIS_* 포함)
- backend/app/main.py (FastAPI 기본, GET /health, GET /ready)
- backend/app/core/config.py (pydantic-settings 기반)
- requirements.txt
- README.md (실행 방법 포함)

[원칙]
- 환경변수 하드코딩 금지 / 모듈형 구조 / 예외처리 포함
```

---

## Sprint 2 · PDF 처리 모듈

```md
이전 Sprint에서 만든 FastAPI 프로젝트 구조를 기반으로
backend/app/pdf/ 하위에 PDF 처리 모듈을 구현하라.

[함수 요구사항]
- detect_pdf_type(pdf_path: str) -> str
  → get_text() 결과 기준 'text' | 'table' | 'scanned' 반환
- extract_text(pdf_path: str) -> str
  → 타입에 따라 PyMuPDF / pdfplumber / Tesseract 분기
- extract_tables(pdf_path: str) -> list[dict]
  → pdfplumber로 표 추출 후 Markdown 형식으로 변환
- ocr_with_tesseract(pdf_path: str) -> str
  → 300dpi 변환 후 Tesseract 5 OCR
- chunk_document(text: str, metadata: dict) -> list[dict]
  → RecursiveCharacterTextSplitter(max=8192, overlap=200)
  → chunk_id = {doc_id}_p{page}_c{idx} 형식

[추가 요구사항]
- 타입힌트 · 예외처리 · logging · 테스트 가능 구조
- 실패 문서는 별도 error_log에 기록
- POST /api/documents/upload 라우터 연결
```

---

## Sprint 3 · 임베딩 및 Qdrant 인덱싱

```md
이전 Sprint의 PDF 처리 모듈을 기반으로
backend/app/rag/ 하위에 임베딩·인덱싱 모듈을 구현하라.

[중요] task_type을 반드시 구분할 것:
- 문서 저장 시: RETRIEVAL_DOCUMENT
- 검색 쿼리 시: RETRIEVAL_QUERY
- output_dimensionality 지정하지 않음 (3072d 풀 차원 사용)

[함수 요구사항]
- embed_document(text: str) -> list[float]
- embed_query(text: str) -> list[float]
- create_qdrant_collection() → Dense 3072d + Sparse BM25 컬렉션
- upsert_chunks_to_qdrant(chunks: list[dict])
- save_document_metadata(doc: dict) → PostgreSQL 저장
- batch_index_pdfs(directory_path: str) → 대량 문서 배치 처리

[추가 요구사항]
- Gemini API Rate Limit 대응: 지수 백오프 재시도 (최대 5회)
- 실패 청크 재시도 큐 구현
- 진행률 로그 출력 (처리 완료 / 전체)
- POST /api/documents/index 라우터 연결
```

---

## Sprint 4 · 하이브리드 검색 파이프라인

```md
이전 Sprint의 인덱싱 모듈을 기반으로
backend/app/rag/ 하위에 3단계 검색 파이프라인을 구현하라.

[검색 3단계]
1. HyDE: Flash-Lite로 가상 문서 300자 생성 → 임베딩
2. 하이브리드 RRF: Dense(Top-40) + Sparse BM25(Top-40) → fusion='rrf' → Top-20
3. Cross-Encoder 리랭킹: ms-marco-MiniLM, Top-20 → Top-8

[함수 요구사항]
- hyde_expand(query: str) -> list[float]
- dense_search(query_vec: list, top_k: int = 40) -> list
- sparse_search(query: str, top_k: int = 40) -> list
- hybrid_search(query: str, top_k: int = 20) -> list
- rerank_results(query: str, results: list, top_k: int = 8) -> list

[검색 결과 필수 포함 항목]
chunk_text, document_title, page, chunk_id, score, tags

[추가 요구사항]
- POST /api/search 라우터 연결
- 검색 결과 Redis 캐싱 (TTL 1시간)
- 검색 latency 로그 기록
```

---

## Sprint 5 · 챗봇 API (SSE 스트리밍)

```md
이전 Sprint의 검색 파이프라인을 기반으로
POST /api/chat 엔드포인트를 구현하라.

[동작 흐름]
1. 사용자 메시지 수신
2. hybrid_search()로 관련 문서 검색
3. 검색 결과를 컨텍스트로 구성
4. Gemini 2.5 Flash로 SSE 스트리밍 응답 생성
5. 근거 문서 목록(sources) 별도 반환

[요청 스키마]
{ messages: [{role, content}], session_id: str }

[응답 방침]
- 문서 근거 기반 응답 원칙
- 근거 없으면 추측 금지, 솔직하게 안내
- 가능한 경우 출처 문서명·페이지 함께 반환
- 멀티턴: ConversationBufferMemory 또는 Redis 히스토리

[추가 요구사항]
- SSE 포맷: data: {chunk}\n\n / data: [DONE]\n\n
- X-Accel-Buffering: no 헤더 설정
- 스트리밍 중 에러 시 error 이벤트 전송
```

---

## Sprint 6 · 제안서 생성 API

```md
이전 Sprint의 검색 파이프라인을 기반으로
POST /api/generate 엔드포인트를 구현하라.

[요청 스키마]
{ customer, solution, section, query }

[동작 흐름]
1. hybrid_search()로 관련 청크 검색 (Top-30 활용)
2. 섹션별 프롬프트 템플릿에 컨텍스트 주입
3. Gemini 2.5 Pro로 SSE 스트리밍 생성

[우선 구현 섹션 및 프롬프트 기법]
- Executive Summary: Role-play + JSON 구조화
- 사업 이해도: Chain-of-Thought
- 기술 방법론: Few-shot (예시 삽입)
- 수행 일정: WBS JSON 생성 → 텍스트 변환
- 투입 인력/공수: 계산 검증 포함
- 레퍼런스 사례: 검색 Top-3 직접 활용

[추가 요구사항]
- 섹션별 프롬프트를 별도 파일로 관리
- proposal_service.py로 비즈니스 로직 분리
- temperature=0.3 (Pro) / 재사용 가능 구조
```

---

## Sprint 7 · Next.js 프론트엔드 연결

```md
Next.js 14 + TypeScript 기반으로 프론트엔드를 구현하라.

[화면 우선순위]
1. 로그인/인증 화면
2. PDF 업로드 화면 (드래그앤드롭, 진행률 표시)
3. 챗봇 화면 (실시간 SSE 스트리밍 렌더링, 출처 표시)
4. 제안서 생성 화면 (섹션 선택, 고객사/솔루션 입력)
5. Tiptap 에디터 화면 (섹션별 재생성 버튼)
6. 문서 다운로드 화면 (DOCX/PDF)

[기술 요구사항]
- App Router 구조
- SSE 수신: EventSource 또는 fetch + ReadableStream
- 상태 관리: Zustand 또는 React Context
- API 클라이언트: lib/api.ts 에 중앙화
- 환경변수: NEXT_PUBLIC_API_URL

[추가 요구사항]
- 로딩/에러 상태 처리
- 모바일 반응형
- 다크모드 지원 (선택)
```

---

## Sprint 8 · 보안 · 캐시 · 모니터링 · K8s

```md
이전 Sprint들의 완성된 코드를 기반으로
운영 수준의 보안·캐시·모니터링·배포를 구현하라.

[보안]
- RBAC: 관리자/사용자 역할 분리 (JWT)
- API 키 Vault (HashiCorp Vault 또는 환경변수 기반)
- 프롬프트 인젝션 방어: 입력 sanitize + 이상 패턴 감지
- CORS, Rate Limiting 미들웨어

[캐시]
- Redis: 임베딩 캐시 (TTL 24h), 검색 캐시 (TTL 1h)
- 캐시 키: SHA256(query + model_id)

[모니터링]
- Prometheus: 응답시간 · 오류율 · Gemini API 비용 추적
- Grafana 대시보드 구성
- /metrics 엔드포인트 노출

[Kubernetes]
- Docker Compose → K8s 매니페스트 변환
- Deployment / Service / ConfigMap / Secret
- HPA 설정
- Ingress 설정
```

---

# 10. 반드시 지켜야 할 개발 원칙

## 10.1 코드 원칙

1. 함수 단위 책임 분리 (Single Responsibility)
2. 서비스 계층 분리 (API → Service → RAG/DB)
3. AI 모델 호출 로직은 반드시 별도 모듈로 분리
4. 환경변수 하드코딩 절대 금지
5. 모든 외부 API 호출에 예외처리 + 재시도 로직 적용
6. 로깅 필수

   * INFO: 정상
   * WARNING: 재시도
   * ERROR: 실패

## 10.2 RAG 품질 원칙

1. 검색(Retrieval)과 생성(Generation) 로직 반드시 분리
2. query 임베딩과 document 임베딩 `task_type` 구분 필수
3. chunk metadata (`page`, `doc_id`, `score`) 끝까지 유지
4. 문서 근거 없는 답변 생성 최소화
5. 검색 결과 score 항상 로그 기록

## 10.3 운영 원칙

1. Docker 기반 재현 가능 환경 (로컬 = 운영)
2. K8s 이관 가능 구조로 처음부터 설계
3. Gemini API 비용 추적 가능한 구조 (요청당 토큰 로그)
4. 모니터링 포인트를 각 모듈에 미리 삽입
5. AI 코딩툴 프롬프트 연속 실행 시 이전 결과 파일 참조

---

# 11. 핵심 데이터 구조

## 11.1 Document 메타데이터 (PostgreSQL)

```json
{
  "document_id": "doc_001",
  "title": "sample_proposal.pdf",
  "source_path": "/data/pdfs/sample_proposal.pdf",
  "pdf_type": "text",
  "industry": "공공",
  "solution_type": "AI 챗봇",
  "year": 2025,
  "page_count": 42,
  "chunk_count": 68,
  "uploaded_at": "2026-03-17T10:00:00",
  "indexed_at": "2026-03-17T10:05:30",
  "status": "indexed"
}
```

> `status`: `pending | indexing | indexed | error`

---

## 11.2 Chunk (Qdrant payload)

```json
{
  "chunk_id": "doc_001_p3_c12",
  "document_id": "doc_001",
  "page": 3,
  "chunk_index": 12,
  "text": "해당 사업의 수행 방안은...",
  "metadata": {
    "title": "sample_proposal.pdf",
    "industry": "공공",
    "solution_type": "AI 챗봇",
    "year": 2025
  }
}
```

---

# 12. 지금 당장 시작하는 한 줄 프롬프트

가장 빠르게 시작하려면 아래 프롬프트 하나로 시작하면 됩니다.

```md
FastAPI + Next.js 14 + Qdrant + PostgreSQL 16 + Redis 7 기반의
PDF RAG 챗봇 및 제안서 자동작성 플랫폼을 구축하려 한다.
사용 AI 모델: gemini-embedding-2-preview (3072d), gemini-2.5-pro,
gemini-2.5-flash, gemini-2.5-flash-lite.

먼저 아래를 구현하라:
1. 모듈형 백엔드 폴더 구조 (api/core/models/schemas/services/rag/pdf/db/utils)
2. Docker Compose (qdrant, postgres, redis, api, frontend 서비스 포함)
3. .env.example (모든 환경변수 키 목록)
4. FastAPI main.py + GET /health + GET /ready
5. pydantic-settings 기반 config.py
6. requirements.txt + README.md (실행 방법)

모듈형 구조와 확장성을 최우선으로 하고, 환경변수 하드코딩은 절대 금지.
```

---

원하시면 다음 단계로 이어서
**“이 마크다운을 바로 노션/깃허브 README용으로 더 다듬은 버전”**으로도 정리해드릴게요.
