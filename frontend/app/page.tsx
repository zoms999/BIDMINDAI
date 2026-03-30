'use client'

import React, { useState, useCallback, useRef } from 'react'

interface UploadedDoc {
  id: string
  filename: string
  status: 'uploading' | 'processing' | 'done' | 'error'
  chunkCount?: number
  uploadedAt: Date
}

export default function DocumentManager() {
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      alert('PDF 파일만 업로드할 수 있습니다.')
      return
    }

    const docId = Math.random().toString(36).slice(2)
    const newDoc: UploadedDoc = {
      id: docId,
      filename: file.name,
      status: 'uploading',
      uploadedAt: new Date(),
    }
    setDocs(prev => [newDoc, ...prev])

    const formData = new FormData()
    formData.append('file', file)

    try {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'processing' } : d))
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setDocs(prev => prev.map(d =>
          d.id === docId ? { ...d, status: 'done', chunkCount: data.chunk_count, id: data.document_id } : d
        ))
      } else {
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'error' } : d))
      }
    } catch {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'error' } : d))
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(uploadFile)
  }, [uploadFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(uploadFile)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatDate = (d: Date) => {
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '방금'
    if (mins < 60) return `${mins}분 전`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}시간 전`
    return `${Math.floor(hrs / 24)}일 전`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>문서 관리</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            {docs.length > 0 ? `총 ${docs.length}개 문서 · 마지막 업로드 ${formatDate(docs[0]?.uploadedAt)}` : 'PDF 문서를 업로드하여 지식 베이스를 구성하세요'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
          + 문서 업로드
        </button>
      </div>

      {/* Drop Zone */}
      <div
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'var(--border-default)'}`,
          background: dragging ? 'var(--accent-glow)' : 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-12)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".pdf" multiple hidden onChange={handleFileChange} />
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📄</div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          PDF 파일을 여기에 끌어다 놓거나 클릭하여 선택하세요
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          최대 50MB · PDF 형식만 지원
        </div>
      </div>

      {/* Document List */}
      {docs.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 120px 90px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)',
            gap: 'var(--space-4)',
          }}>
            <div>파일명</div>
            <div>청크</div>
            <div>상태</div>
            <div>업로드</div>
          </div>
          {docs.map(doc => (
            <div key={doc.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 120px 90px',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--border-subtle)',
              gap: 'var(--space-4)',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                <span>📄</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.filename}
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {doc.chunkCount != null ? doc.chunkCount : '—'}
              </div>
              <div>
                {doc.status === 'done' && (
                  <span className="status-badge done"><span className="status-dot" />완료</span>
                )}
                {doc.status === 'uploading' && (
                  <span className="status-badge loading"><span className="status-dot pulse" />업로드 중</span>
                )}
                {doc.status === 'processing' && (
                  <span className="status-badge loading"><span className="status-dot pulse" />처리 중</span>
                )}
                {doc.status === 'error' && (
                  <span className="status-badge error"><span className="status-dot" />오류</span>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {formatDate(doc.uploadedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)', opacity: 0.4 }}>📂</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>업로드된 문서가 없습니다</p>
        </div>
      )}
    </div>
  )
}
