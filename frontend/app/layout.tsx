'use client'

import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'

// ── Toast Context ──────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'loading'
interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}
interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
}
const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })
export const useToast = () => useContext(ToastContext)

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...toast, id, duration: toast.duration ?? 4000 }
    setToasts(prev => [...prev.slice(-2), newToast])
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), newToast.duration)
    }
  }, [])

  const icons: Record<ToastType, string> = { success: '✅', error: '❌', info: 'ℹ️', loading: '⏳' }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">{icons[t.type]}</div>
            <div>
              <div className="toast-title">{t.title}</div>
              {t.description && <div className="toast-desc">{t.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Command Palette ────────────────────────────────────────────
const COMMANDS = [
  { icon: '📁', label: '문서 관리', href: '/' },
  { icon: '💬', label: 'RAG 챗봇', href: '/chat' },
  { icon: '📝', label: '제안서 생성', href: '/proposal' },
]

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-modal" onClick={e => e.stopPropagation()}>
        <div className="palette-input-row">
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            autoFocus
            className="palette-input"
            placeholder="무엇이든 검색하세요..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', color: 'var(--text-muted)' }}>ESC</kbd>
        </div>
        <div className="palette-results">
          <div className="palette-section-label">페이지 이동</div>
          {filtered.map(cmd => (
            <Link key={cmd.href} href={cmd.href} className="palette-item" onClick={onClose}
              style={{ color: pathname === cmd.href ? 'var(--accent-primary)' : undefined }}>
              <span className="palette-item-icon">{cmd.icon}</span>
              {cmd.label}
              {pathname === cmd.href && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>현재 위치</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: '📁', label: '문서 관리',    href: '/' },
  { icon: '💬', label: 'RAG 챗봇',     href: '/chat' },
  { icon: '📝', label: '제안서 생성',  href: '/proposal' },
]

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-section">
        <div className="sidebar-label" style={{ opacity: collapsed ? 0 : 1 }}>메뉴</div>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </Link>
        ))}
      </div>
      <button className="sidebar-collapse-btn" onClick={onToggle} title={collapsed ? '사이드바 열기' : '사이드바 접기'}>
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  )
}

// ── Top Nav ────────────────────────────────────────────────────
function TopNav({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname()
  const currentPage = NAV_ITEMS.find(n => n.href === pathname)

  return (
    <header className="topnav">
      <div className="topnav-logo" style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
        BidMind<span>AI</span>
      </div>
      <div className="topnav-search">
        <button className="search-trigger" onClick={onOpenPalette}>
          <span>🔍</span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            {currentPage ? `${currentPage.icon} ${currentPage.label}` : '검색...'}
          </span>
          <kbd>Ctrl+K</kbd>
        </button>
      </div>
      <div className="topnav-actions">
        <div className="avatar-btn">BM</div>
      </div>
    </header>
  )
}

// ── Root Layout ────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <html lang="ko">
      <head>
        <title>BidMindAI</title>
        <meta name="description" content="AI 기반 입찰 제안서 생성 플랫폼" />
      </head>
      <body>
        <ToastProvider>
          <div className="app-shell">
            <TopNav onOpenPalette={() => setPaletteOpen(true)} />
            <div className="app-body">
              <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
              <main className="main-content">
                {children}
              </main>
            </div>
          </div>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </ToastProvider>
      </body>
    </html>
  )
}
