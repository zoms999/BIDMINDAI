'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Source = { filename: string; chunk_id: string }

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
  timestamp: Date
}

type Session = {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatSessionDate(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 86400000) return '오늘'
  if (diff < 172800000) return '어제'
  return `${Math.floor(diff / 86400000)}일 전`
}

const TypingDots = () => (
  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', height: 20 }}>
    {[0, 0.2, 0.4].map((delay, i) => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--accent-primary)',
        opacity: 0.6,
        animation: `pulse 1.2s ${delay}s ease-in-out infinite`,
        display: 'inline-block'
      }} />
    ))}
  </span>
)

export default function Chatbot() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isClient, setIsClient] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedSource, setExpandedSource] = useState<number | null>(null)
  
  // Document Selection State
  const [availableDocs, setAvailableDocs] = useState<{id: string, filename: string}[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const messages = activeSession?.messages ?? []

  useEffect(() => {
    // Load sessions from localStorage on client mount
    setIsClient(true)
    try {
      const saved = localStorage.getItem('chat_sessions')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          setSessions(parsed.map((s: Session) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            messages: s.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) }))
          })))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Fetch available documents after client mount
    if (!isClient) return
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    fetch(`${apiUrl}/api/documents/`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // only show processed docs
          setAvailableDocs(data.filter(d => d.status === 'processed' || d.status === 'done'))
        }
      })
      .catch(console.error)
  }, [isClient])

  useEffect(() => {
    try {
      localStorage.setItem('chat_sessions', JSON.stringify(sessions))
    } catch {}
  }, [sessions])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const newSession = useCallback(() => {
    const id = Math.random().toString(36).slice(2)
    const s: Session = { id, title: '새 대화', messages: [], createdAt: new Date() }
    setSessions(prev => [s, ...prev])
    setActiveSessionId(id)
  }, [])

  useEffect(() => {
    if (!isClient) return
    if (!activeSessionId && sessions.length === 0) newSession()
    else if (!activeSessionId && sessions.length > 0) setActiveSessionId(sessions[0].id)
  }, [isClient, activeSessionId, sessions, newSession])

  const updateActiveSession = useCallback((updater: (msgs: Message[]) => Message[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updater(s.messages) } : s))
  }, [activeSessionId])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    let sessionId = activeSessionId
    if (!sessionId) {
      const id = Math.random().toString(36).slice(2)
      const s: Session = { id, title: '새 대화', messages: [], createdAt: new Date() }
      setSessions(prev => [s, ...prev])
      setActiveSessionId(id)
      sessionId = id
    }

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() }
    const historyForApi = messages.map(m => ({ role: m.role, content: m.content }))

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? input.slice(0, 30) : s.title,
            messages: [...s.messages, userMsg, { role: 'assistant', content: '', isStreaming: true, timestamp: new Date() }]
          }
        : s
    ))

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    const updateLastMsg = (updater: (m: Message) => Message) => {
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s
        const msgs = [...s.messages]
        msgs[msgs.length - 1] = updater(msgs[msgs.length - 1])
        return { ...s, messages: msgs }
      }))
    }

    try {
      const payload: any = { query: userMsg.content, history: historyForApi }
      if (selectedDocIds.length > 0) {
        payload.document_ids = selectedDocIds
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your_secret_key_here'
        },
        body: JSON.stringify(payload)
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let buffer = ''
      let sources: Source[] = []

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
              if (data.type === 'sources') sources = data.data || []
              else if (data.type === 'chunk') {
                updateLastMsg(m => ({ ...m, content: m.content + data.data, isStreaming: true }))
              } else if (data.type === 'done') {
                updateLastMsg(m => ({ ...m, isStreaming: false, sources }))
              }
            } catch {}
          }
        }
      }
    } catch {
      updateLastMsg(m => ({
        ...m, isStreaming: false,
        content: '⚠️ 서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const allSources = messages.flatMap(m => m.sources ?? []).filter(s => s.filename)
  const uniqueSources = allSources.filter((s, i) => allSources.findIndex(x => x.filename === s.filename) === i)

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - var(--topnav-height))', margin: 'calc(-1 * var(--space-8))', overflow: 'hidden' }}>

      {/* Left Sidebar: Session History + Document Selector */}
      <div style={{
        width: 280, borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-void)', display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-xs)' }} onClick={newSession}>
            + 새 대화
          </button>
        </div>

        {/* Document Selector Header */}
        {isClient && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
             <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>📄 참조 문서 한정</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden' }}>
               {availableDocs.length === 0 ? (
                 <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>업로드된 문서가 없습니다.</div>
               ) : (
                 availableDocs.map(doc => (
                   <label 
                     key={doc.id} 
                     style={{ 
                       display: 'flex', 
                       alignItems: 'flex-start', 
                       gap: '6px', 
                       fontSize: '0.7rem', 
                       color: 'var(--text-primary)', 
                       cursor: 'pointer',
                       padding: '4px',
                       borderRadius: '4px',
                       transition: 'background 0.2s'
                     }}
                     title={doc.filename}
                     onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                     onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                   >
                     <input
                       type="checkbox"
                       checked={selectedDocIds.includes(doc.id)}
                       onChange={(e) => {
                         if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                         else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                       }}
                       style={{ marginTop: '2px', flexShrink: 0 }}
                     />
                     <span style={{ 
                       flex: 1,
                       wordBreak: 'break-word',
                       lineHeight: 1.4,
                       minWidth: 0
                     }}>
                       {doc.filename}
                     </span>
                   </label>
                 ))
               )}
             </div>
             {selectedDocIds.length > 0 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', marginTop: '6px', fontWeight: 600 }}>
                  ✓ {selectedDocIds.length}개 문서 선택됨
                </div>
             )}
          </div>
        )}

        <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          대화 기록
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-2) var(--space-2)' }}>
          {sessions.map(s => (
            <button key={s.id} onClick={() => setActiveSessionId(s.id)} style={{
              width: '100%', textAlign: 'left', background: s.id === activeSessionId ? 'var(--bg-elevated)' : 'transparent',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '8px var(--space-3)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 2
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: s.id === activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>
                {s.title}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatSessionDate(s.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Messages */}
        <div role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 'var(--space-4)', marginTop: '20vh' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>💬</div>
              <div style={{ fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                업로드된 RFP 문서에 대해 질문해보세요
              </div>
            </div>
          )}
          {messages.map((m, idx) => (
            <div key={idx} className="msg-appear" style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: m.role === 'user' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-dim))' : 'var(--bg-elevated)',
                border: m.role === 'assistant' ? '1px solid var(--border-default)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700,
                color: m.role === 'user' ? 'var(--text-inverse)' : 'var(--text-secondary)'
              }}>
                {m.role === 'user' ? 'ME' : 'AI'}
              </div>
              <div style={{ maxWidth: '75%' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textAlign: m.role === 'user' ? 'right' : 'left', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {m.role === 'user' ? 'You' : 'BidMindAI'} · {formatTime(m.timestamp)}
                </div>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  ...(m.role === 'user'
                    ? { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', borderTopRightRadius: 4 }
                    : { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderTopLeftRadius: 4 }),
                  fontSize: 'var(--text-sm)', lineHeight: 1.7,
                }}>
                  {m.content === '' && m.isStreaming ? (
                    <TypingDots />
                  ) : (
                    <span className={m.isStreaming && m.content ? 'cursor-blink' : ''}>
                      {m.role === 'assistant' ? (
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </span>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {m.sources.filter(s => s.filename).map((s, si) => (
                        <button key={si} className="source-tag-btn" onClick={() => setExpandedSource(si === expandedSource ? null : si)} title={s.filename}>
                          📄 {s.filename.length > 24 ? s.filename.slice(0, 22) + '…' : s.filename}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: 'var(--space-4) var(--space-8) var(--space-6)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-void)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', transition: 'border-color 0.2s', outline: 'none' }}
            onFocus={() => {}} onBlur={() => {}}>
            <textarea
              ref={textareaRef}
              style={{
                flex: 1, background: 'transparent', border: 'none', resize: 'none',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)',
                lineHeight: 1.6, minHeight: 24, maxHeight: 160, overflowY: 'auto', outline: 'none'
              }}
              placeholder="질문을 입력하세요 (Shift+Enter 줄바꿈)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              aria-label="채팅 입력"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: input.trim() && !isLoading ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                border: 'none', cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', flexShrink: 0, transition: 'all 0.2s',
                color: input.trim() && !isLoading ? 'var(--text-inverse)' : 'var(--text-muted)',
                boxShadow: input.trim() && !isLoading ? '0 4px 12px var(--accent-glow)' : 'none'
              }}
              aria-label="전송"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Enter 전송 · Shift+Enter 줄바꿈
          </div>
        </div>
      </div>

      {/* Source Panel */}
      {uniqueSources.length > 0 && (
        <div style={{
          width: 260, borderLeft: '1px solid var(--border-subtle)',
          background: 'var(--bg-void)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto'
        }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              📌 참조 소스
            </div>
          </div>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {uniqueSources.map((s, i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-3)' }} title={s.filename}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📄</span>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.filename}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
