위 개발계획서를 AI 코딩툴에서 바로 활용하기 좋게 정리해드릴게요.아래에 AI 코딩툴에서 바로 쓸 수 있도록 **구조화된 개발 지시서**를 정리했습니다.

---

## 프로젝트 개요

**목표**: 260페이지 이상 PDF를 기반으로 IT 제안서를 자동 생성하는 RAG 챗봇 시스템  
**기간**: 5개월 (Phase 1~4)  
**핵심 스택**: Gemini 전체 스택 + Qdrant + FastAPI + Next.js

---

## 기술 스택 확정

**LLM 역할 분담** (가장 중요한 포인트)

| 모델 | 용도 | 이유 |
|---|---|---|
| `gemini-2.5-pro` | 제안서 섹션 생성 | 1M ctx, 최고 품질 |
| `gemini-2.5-flash` | 챗봇 멀티턴 대화 | 빠른 응답 |
| `gemini-2.5-flash-lite` | HyDE 쿼리 확장 + PDF 메타 태깅 | 최저 비용 |
| `gemini-embedding-2-preview` | 벡터 임베딩 | 3,072d, task_type 구분 필수 |

**저장소**: Qdrant (HNSW m=32) · PostgreSQL 16 · Redis 7  
**백엔드**: FastAPI 0.111 / Python 3.12  
**프론트**: Next.js 14 + TypeScript + Tiptap 에디터

---

## Phase별 개발 지시

### Phase 1 (1~2개월): 인프라 + 임베딩 파이프라인

**AI 코딩툴에 전달할 작업 단위:**

```
1. Docker Compose 셋업
   - qdrant (3,072d 컬렉션, HNSW m=32, ef_construct=256)
   - postgres:16, redis:7-alpine, fastapi 앱 서버

2. PDF 파싱 모듈
   - detect_pdf_type(): get_text() 결과로 scanned/text 자동 분류
   - 일반 PDF → PyMuPDF, 표 포함 → pdfplumber, 스캔 → Tesseract 5

3. 임베딩 파이프라인
   - embed_document(): task_type='RETRIEVAL_DOCUMENT'
   - embed_query(): task_type='RETRIEVAL_QUERY'
   - 청크: RecursiveCharacterTextSplitter(max=8192, overlap=200)
   - 260개 PDF 배치 임베딩 + Rate Limit 처리

4. BM25 Sparse 인덱스 구축 (Dense + Sparse 하이브리드 준비)
```

### Phase 2 (2~3개월): RAG 엔진 고도화

```
5. HyDE 모듈
   - Flash-Lite로 가상 문서 300자 생성 → embed_query()로 벡터화

6. 하이브리드 RRF 검색
   - Qdrant prefetch: dense(Top-40) + sparse(Top-40) → fusion='rrf' → Top-20

7. Cross-Encoder 리랭킹
   - ms-marco-MiniLM으로 Top-20 → Top-8 필터

8. RAGAS 평가
   - 평가셋 100개 / 목표: Recall@5 ≥ 85%
```

### Phase 3 (3~4개월): 챗봇 UI + 제안서 생성

```
9. Gemini 2.5 Flash 챗봇 체인
   - ConversationBufferMemory, 멀티턴, SSE 스트리밍

10. Gemini 2.5 Pro 제안서 생성 체인
    - 섹션별 프롬프트: Executive Summary / 기술 방법론 / 수행 일정 / 견적
    - FastAPI SSE 엔드포인트: /api/generate, /api/chat

11. Next.js 프론트
    - 실시간 SSE 스트리밍 렌더링
    - Tiptap 에디터: 섹션별 재생성 버튼

12. python-docx로 DOCX 출력 + PDF 변환
```

### Phase 4 (4~5개월): 성능 · 보안 · 운영

```
13. Redis 캐싱 레이어 (임베딩 캐시 + 검색 결과 캐시)
14. RBAC + API 키 Vault + 프롬프트 인젝션 방어
15. Kubernetes 배포 (Docker Compose → K8s 마이그레이션)
16. Prometheus + Grafana 모니터링 대시보드
```

---

## AI 코딩툴 활용 팁

**한 번에 요청할 단위**: 위 번호(1~16) 기준으로 1개씩 요청하는 것이 효과적입니다. 예를 들어:

> "2번 작업: PyMuPDF + pdfplumber + Tesseract를 사용해서 PDF 타입 자동 감지 및 텍스트 추출 모듈을 작성해줘. detect_pdf_type()과 extract_text() 함수 포함."

**환경변수 통일**: `GEMINI_API_KEY` 하나로 임베딩 + LLM 모두 사용 가능 (단일 키)

**코드 참고 포인트**: 계획서에 이미 핵심 코드 스니펫(임베딩, HyDE, FastAPI SSE 등)이 포함되어 있으니, 코딩툴에 그대로 붙여넣고 확장 요청하면 됩니다.