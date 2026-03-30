'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SECTIONS = [
  { id: 'summary',     label: '요약 작성',        icon: '📋' },
  { id: 'analysis',    label: '문제 분석',         icon: '🔍' },
  { id: 'solution',    label: '솔루션 구성',       icon: '💡' },
  { id: 'methodology', label: '방법론 정리',       icon: '📐' },
  { id: 'budget',      label: '예산 계획',         icon: '💰' },
  { id: 'references',  label: '레퍼런스 추가',    icon: '🏆' },
]

export default function ProposalGenerator() {
  const [topic, setTopic] = useState('')
  const [requirements, setRequirements] = useState('')
  const [proposal, setProposal] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentSection, setCurrentSection] = useState(-1)
  const resultRef = useRef<HTMLDivElement>(null)

  // Document Selection State
  const [availableDocs, setAvailableDocs] = useState<{id: string, filename: string}[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])

  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Fetch available documents after client mount
    if (!isClient) return
    
    fetch('http://localhost:8000/api/documents/')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // only show processed docs
          setAvailableDocs(data.filter(d => d.status === 'processed' || d.status === 'done'))
        }
      })
      .catch(console.error)
  }, [isClient])

  // Simulate section progression based on word count
  useEffect(() => {
    if (!isGenerating || !proposal) return
    const wordCount = proposal.split(/\s+/).length
    const sectionIdx = Math.min(Math.floor(wordCount / 80), SECTIONS.length - 1)
    setCurrentSection(sectionIdx)
  }, [proposal, isGenerating])

  const scrollToBottom = () => {
    resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    if (isGenerating) scrollToBottom()
  }, [proposal, isGenerating])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || isGenerating) return

    setProposal('')
    setIsGenerating(true)
    setCurrentSection(0)

    try {
      const payload: any = { topic, requirements }
      if (selectedDocIds.length > 0) {
        payload.document_ids = selectedDocIds
      }

      const res = await fetch('http://localhost:8000/api/generate/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your_secret_key_here'
        },
        body: JSON.stringify(payload)
      })

      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let buffer = ''

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.replace('data: ', ''))
              if (data.type === 'chunk') setProposal(prev => prev + data.data)
            } catch {}
          }
        }
      }
    } catch {
      setProposal(prev => prev + "\n\n⚠️ 생성 중 오류가 발생했습니다.")
    } finally {
      setIsGenerating(false)
      setCurrentSection(SECTIONS.length)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(proposal)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([proposal], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${topic.slice(0, 30).replace(/\s+/g, '_')}_proposal.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - var(--topnav-height))', margin: 'calc(-1 * var(--space-8))', overflow: 'hidden' }}>

      {/* Input Panel */}
      <div style={{
        width: 360, borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-void)', display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflowY: 'auto'
      }}>
        <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 4 }}>제안서 생성</h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>RAG 기반 AI 제안서 자동 작성</p>
        </div>

        <form onSubmit={handleGenerate} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', flex: 1 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              ◆ RFP 제목
            </label>
            <input
              required
              className="input-field"
              placeholder="예: AI 콜센터 구축 사업"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              ◆ 요구사항 / 범위
            </label>
            <textarea
              className="input-field"
              style={{ flex: 1, minHeight: 140, resize: 'none' }}
              placeholder="하드웨어, 소프트웨어, 일정, 예산, 제약사항 등을 자유롭게 기술하세요"
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              ◆ 참조 문서 한정 (선택)
            </label>
            {isClient && (
              <div className="card" style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {availableDocs.length === 0 ? (
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>업로드된 문서가 없습니다.</div>
                 ) : (
                   availableDocs.map(doc => (
                     <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                       <input
                         type="checkbox"
                         checked={selectedDocIds.includes(doc.id)}
                         onChange={(e) => {
                           if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                           else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                         }}
                         disabled={isGenerating}
                       />
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
                     </label>
                   ))
                 )}
              </div>
            )}
          </div>

          {/* Generation Progress */}
          {(isGenerating || currentSection >= 0) && (
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>진행 상황</div>
              {SECTIONS.map((sec, i) => {
                const isDone = currentSection > i
                const isCurrent = currentSection === i && isGenerating
                return (
                  <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                    <span style={{ width: 18, textAlign: 'center' }}>
                      {isDone ? '✅' : isCurrent ? '🔄' : '⬜'}
                    </span>
                    <span style={{ color: isDone ? 'var(--green-accent)' : isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: isCurrent ? 600 : 400 }}>
                      {sec.icon} {sec.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={!topic.trim() || isGenerating} style={{ justifyContent: 'center', padding: '12px' }}>
            {isGenerating ? '⏳ 생성 중...' : '▶ 제안서 생성'}
          </button>
        </form>
      </div>

      {/* Result Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-base)' }}>
        {/* Result Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-void)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            📄 Draft Output
            {proposal && !isGenerating && (
              <span style={{ marginLeft: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
                {proposal.split(/\s+/).length}단어
              </span>
            )}
          </div>
          {proposal && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: '6px 12px' }} onClick={handleCopy}>
                {copied ? '✅ 복사됨' : '📋 복사'}
              </button>
              <button className="btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: '6px 12px' }} onClick={handleDownload}>
                📥 다운로드
              </button>
            </div>
          )}
        </div>

        {/* Result Content */}
        <div ref={resultRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
          {!proposal && !isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>📝</div>
              <p style={{ fontSize: 'var(--text-sm)' }}>제안서 생성 결과가 여기에 표시됩니다</p>
            </div>
          )}
          {proposal && (
            <div className="markdown-body" style={{ maxWidth: 760, margin: '0 auto' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal}</ReactMarkdown>
              {isGenerating && (
                <span style={{ display: 'inline-block', width: 2, height: '1.2em', background: 'var(--accent-primary)', marginLeft: 2, animation: 'cursorBlink 0.7s steps(1) infinite', verticalAlign: 'text-bottom' }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
