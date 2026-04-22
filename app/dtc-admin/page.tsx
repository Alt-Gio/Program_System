'use client'

import { useState, useEffect, Fragment, useMemo, useRef, createContext, useContext, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import './dtc-admin.css'

// ─── Toast Context ────────────────────────────────────────────────────────────
type Toast = { id: number; type: 'ok' | 'err' | 'info'; msg: string }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
const useToast = () => useContext(ToastCtx)

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.type === 'ok' ? '#059669' : t.type === 'err' ? '#dc2626' : '#0038A8',
            color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 380,
            animation: 'dtc-slide-in 0.2s ease-out',
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ─── Modal Component ──────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width, maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f3f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36' }}>{title}</div>
          <button onClick={onClose} style={{ color: '#9ca3af', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 22, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog Hook ──────────────────────────────────────────────────────
function useConfirm() {
  const [state, setState] = useState<{ open: boolean; title: string; msg: string; resolve?: (ok: boolean) => void }>({ open: false, title: '', msg: '' })
  const confirm = useCallback((title: string, msg: string) => {
    return new Promise<boolean>((resolve) => setState({ open: true, title, msg, resolve }))
  }, [])
  const dialog = (
    <Modal open={state.open} onClose={() => { state.resolve?.(false); setState((s) => ({ ...s, open: false })) }} title={state.title} width={400}>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 18, lineHeight: 1.5 }}>{state.msg}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="dtc-btn-ghost" onClick={() => { state.resolve?.(false); setState((s) => ({ ...s, open: false })) }}>Cancel</button>
        <button className="dtc-btn-danger" onClick={() => { state.resolve?.(true); setState((s) => ({ ...s, open: false })) }}>Confirm</button>
      </div>
    </Modal>
  )
  return { confirm, dialog }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) }
  catch { return iso }
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}
function hoursBetween(start: string, end?: string | null) {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  return Math.max(0, (e - s) / 3_600_000)
}
function deriveStatus(log: { timeIn: string; timeOut?: string | null; plannedDurationHours: number }) {
  if (log.timeOut) return 'COMPLETED'
  const elapsed = hoursBetween(log.timeIn)
  if (elapsed > log.plannedDurationHours) return 'OVERDUE'
  return 'ACTIVE'
}
function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── SVG Icon Component ───────────────────────────────────────────────────────
const ICON_PATHS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z',
  logbook: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  pc: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  announce: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  reports: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  wifi: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
  trend: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  export: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4',
  camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
}

function Icon({ name, size = 15, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const pathData = ICON_PATHS[name] ?? ''
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {pathData.split(' M').filter(Boolean).map((d, i) => (
        <path key={i} d={(i === 0 ? '' : 'M') + d} />
      ))}
    </svg>
  )
}

// ─── SparkBar ─────────────────────────────────────────────────────────────────
function SparkBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, background: color, opacity: 0.15 + (v / max) * 0.85, borderRadius: '2px 2px 0 0', height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, spark, trend }: {
  label: string; value: string | number; sub: string; icon: string; color: string;
  spark?: number[]; trend?: number
}) {
  return (
    <div className="dtc-card dtc-stat-card" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={color} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? '#059669' : '#dc2626', background: trend >= 0 ? '#d1fae5' : '#fee2e2', padding: '2px 7px', borderRadius: 20 }}>
            {trend >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1f36', letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
      {spark && <div style={{ marginTop: 12 }}><SparkBar data={spark} color={color} /></div>}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const logs = useQuery(api.dtcLogs.getRecent, { limit: 100 }) ?? []
  const pcs = useQuery(api.dtcPcs.getAll) ?? []
  const today = new Date().toISOString().slice(0, 10)

  const todayLogs = useMemo(() => logs.filter((l) => l.timeIn.startsWith(today)), [logs, today])
  const activeCount = todayLogs.filter((l) => !l.timeOut).length
  const completedCount = todayLogs.filter((l) => l.timeOut).length
  const ratedLogs = todayLogs.filter((l) => l.satisfactionRating != null)
  const avgRating = ratedLogs.length
    ? (ratedLogs.reduce((a, b) => a + (b.satisfactionRating ?? 0), 0) / ratedLogs.length).toFixed(1)
    : '—'
  const pcInUse = pcs.filter((p) => p.status === 'IN_USE').length

  // Weekly chart — group last 7 days
  const weeklyData = useMemo(() => {
    const days: { day: string; date: string; pc: number; wifi: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-PH', { weekday: 'short' })
      const dayLogs = logs.filter((l) => l.timeIn.startsWith(key))
      days.push({
        day: label,
        date: key,
        pc: dayLogs.filter((l) => l.equipmentUsed.includes('Desktop Computer')).length,
        wifi: dayLogs.filter((l) => l.equipmentUsed.includes('Internet Only')).length,
      })
    }
    return days
  }, [logs])
  const maxChart = Math.max(5, ...weeklyData.map((d) => Math.max(d.pc, d.wifi)))

  // Purpose breakdown
  const purposeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    todayLogs.forEach((l) => { counts[l.purpose] = (counts[l.purpose] || 0) + 1 })
    const total = todayLogs.length || 1
    const colors = ['#0038A8', '#6882FF', '#059669', '#d97706', '#9ca3af', '#7c3aed']
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count], i) => ({ label, pct: Math.round((count / total) * 100), color: colors[i] ?? '#9ca3af', count }))
  }, [todayLogs])

  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard label="Active Sessions" value={activeCount} sub="Live right now" icon="user" color="#0038A8" spark={weeklyData.map((d) => d.pc + d.wifi)} />
        <StatCard label="Completed Today" value={completedCount} sub="Since 12:00 AM" icon="check" color="#059669" spark={weeklyData.map((d) => d.pc + d.wifi)} />
        <StatCard label="PCs In Use" value={`${pcInUse}/${pcs.length}`} sub="Workstations" icon="pc" color="#7c3aed" spark={weeklyData.map((d) => d.pc)} />
        <StatCard label="Avg. Rating" value={`${avgRating}${avgRating !== '—' ? '\u2605' : ''}`} sub={`From ${ratedLogs.length} ratings`} icon="trend" color="#d97706" />
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {/* Weekly Chart */}
        <div className="dtc-card" style={{ flex: 1.4, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Weekly Visitors</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Last 7 days &mdash; Live data</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#0038A8', display: 'inline-block' }} />Desktop</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#6882FF', display: 'inline-block' }} />WiFi</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 4 }}>
            {weeklyData.map((d, i) => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}
                onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, position: 'relative' }}>
                  {hoveredBar === i && (
                    <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: '#1a1f36', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 10 }}>
                      PC: {d.pc} &middot; WiFi: {d.wifi}
                    </div>
                  )}
                  <div style={{ flex: 1, background: hoveredBar === i ? '#0038A8' : '#0038A8cc', borderRadius: '4px 4px 0 0', height: `${(d.pc / maxChart) * 100}%`, transition: 'all 0.2s', minHeight: d.pc > 0 ? 2 : 0 }} />
                  <div style={{ flex: 1, background: hoveredBar === i ? '#6882FF' : '#6882FFaa', borderRadius: '4px 4px 0 0', height: `${(d.wifi / maxChart) * 100}%`, transition: 'all 0.2s', minHeight: d.wifi > 0 ? 2 : 0 }} />
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{d.day}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, padding: '12px 14px', background: '#f8faff', borderRadius: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0038A8' }}>{weeklyData.reduce((a, b) => a + b.pc, 0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>PC Sessions</div>
            </div>
            <div style={{ width: 1, background: '#e5e7eb' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#6882FF' }}>{weeklyData.reduce((a, b) => a + b.wifi, 0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>WiFi Sessions</div>
            </div>
            <div style={{ width: 1, background: '#e5e7eb' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{weeklyData.reduce((a, b) => a + b.pc + b.wifi, 0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Total</div>
            </div>
          </div>
        </div>

        {/* PC Status */}
        <div className="dtc-card" style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Workstation Status</div>
            <button className="dtc-btn-ghost" style={{ fontSize: 11 }} onClick={() => onNavigate('workstations')}>Manage &rarr;</button>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Live overview</div>
          {pcs.length === 0 ? (
            <div className="dtc-empty" style={{ flex: 1 }}>No workstations registered yet. <br /><button className="dtc-btn-ghost" style={{ color: '#0038A8', marginTop: 8 }} onClick={() => onNavigate('workstations')}>Add one &rarr;</button></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, flex: 1 }}>
              {pcs.map((pc) => {
                const colors: Record<string, { bg: string; border: string; dot: string }> = {
                  ONLINE: { bg: '#d1fae5', border: '#6ee7b7', dot: '#059669' },
                  IN_USE: { bg: '#ffedd5', border: '#fcd34d', dot: '#d97706' },
                  OFFLINE: { bg: '#f3f4f6', border: '#d1d5db', dot: '#9ca3af' },
                  MAINTENANCE: { bg: '#fef3c7', border: '#fcd34d', dot: '#d97706' },
                }
                const c = colors[pc.status] || colors.OFFLINE
                const user = pc.logs?.[0]?.fullName
                return (
                  <div key={pc._id} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                    title={user ? `${pc.name} \u2014 ${user}` : pc.name}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{pc.name}</div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, margin: '4px auto 0' }} />
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Available', color: '#059669', count: pcs.filter((p) => p.status === 'ONLINE').length },
              { label: 'In Use', color: '#d97706', count: pcs.filter((p) => p.status === 'IN_USE').length },
              { label: 'Offline', color: '#9ca3af', count: pcs.filter((p) => p.status === 'OFFLINE').length },
              { label: 'Maint.', color: '#d97706', count: pcs.filter((p) => p.status === 'MAINTENANCE').length },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
                <span style={{ fontWeight: 600 }}>{s.count}</span> {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="dtc-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f3f9' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Recent Logbook Entries</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Today, {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <button className="dtc-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} onClick={() => onNavigate('logbook')}>
            <Icon name="eye" size={13} /> View All
          </button>
        </div>
        {todayLogs.length === 0 ? (
          <div className="dtc-empty">No entries today. Create one from the Logbook page.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Agency</th><th>Service</th><th>Time In</th><th>Duration</th><th>Status</th><th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {todayLogs.slice(0, 6).map((log) => {
                const status = deriveStatus(log)
                const duration = hoursBetween(log.timeIn, log.timeOut).toFixed(1)
                return (
                  <tr key={log._id}>
                    <td style={{ fontWeight: 600, color: '#1a1f36' }}>{log.fullName}</td>
                    <td style={{ color: '#6b7280' }}>{log.agency}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {log.equipmentUsed.map((e) => (
                          <span key={e} className="dtc-badge dtc-badge-blue" style={{ fontSize: 10 }}>{e === 'Desktop Computer' ? '\uD83D\uDDA5\uFE0F PC' : '\uD83D\uDCF6 WiFi'}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtTime(log.timeIn)}</td>
                    <td style={{ color: '#6b7280' }}>{duration}h</td>
                    <td>
                      <span className={`dtc-badge ${status === 'ACTIVE' ? 'dtc-badge-green' : status === 'OVERDUE' ? 'dtc-badge-red' : 'dtc-badge-gray'}`}>
                        {status === 'ACTIVE' && <span className="dtc-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
                        {status}
                      </span>
                    </td>
                    <td>{log.satisfactionRating ? '\u2B50'.repeat(log.satisfactionRating) : <span style={{ color: '#d1d5db', fontSize: 12 }}>&mdash;</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Purpose breakdown */}
      {purposeBreakdown.length > 0 && (
        <div className="dtc-card" style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 16 }}>Top Purposes Today</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {purposeBreakdown.map((p) => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#374151', width: 220, flexShrink: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
                <div style={{ flex: 1, height: 8, background: '#f1f3f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.color, width: 48, textAlign: 'right' }}>{p.count} ({p.pct}%)</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Logbook Page ─────────────────────────────────────────────────────────────
const PURPOSES = [
  'Online Job Application', 'Government Transaction', 'Digital Literacy / Learning',
  'SSS Online Transaction', 'PhilHealth Online Transaction', 'BIR / Business Transaction',
  'Email and Communication', 'Resume / CV Preparation', 'Research / Study',
  'Freelance Work', 'Online Scholarship Application', 'Other',
]
const SERVICE_TYPES = ['Internet Access', 'Document Preparation', 'Online Transaction', 'Training / Tutorial', 'Other']

type DtcLog = {
  _id: Id<'dtcLogs'>
  fullName: string
  agency: string
  purpose: string
  equipmentUsed: string[]
  pcId?: Id<'dtcPcs'> | null
  pc?: { _id: Id<'dtcPcs'>; name: string } | null
  plannedDurationHours: number
  serviceType: string
  timeIn: string
  timeOut?: string | null
  satisfactionRating?: number | null
  remarks?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

function Logbook() {
  const logs = (useQuery(api.dtcLogs.getRecent, { limit: 200 }) ?? []) as DtcLog[]
  const pcs = useQuery(api.dtcPcs.getAll) ?? []
  const createLog = useMutation(api.dtcLogs.create)
  const updateLog = useMutation(api.dtcLogs.update)
  const toast = useToast()
  const { dialog } = useConfirm()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<DtcLog | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState<DtcLog | null>(null)

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const q = search.toLowerCase()
      const matchSearch = !q || l.fullName.toLowerCase().includes(q) || l.agency.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q)
      const status = deriveStatus(l)
      const matchFilter = filter === 'ALL' || status === filter
      return matchSearch && matchFilter
    })
  }, [logs, search, filter])

  function exportCsv() {
    const rows: (string | number | null | undefined)[][] = [
      ['Date', 'Full Name', 'Agency', 'Purpose', 'Service Type', 'Equipment', 'PC', 'Time In', 'Time Out', 'Duration (h)', 'Status', 'Rating', 'Remarks', 'Email', 'Phone'],
    ]
    filtered.forEach((l) => rows.push([
      fmtDate(l.timeIn), l.fullName, l.agency, l.purpose, l.serviceType,
      l.equipmentUsed.join(' + '), l.pc?.name ?? '',
      fmtTime(l.timeIn), l.timeOut ? fmtTime(l.timeOut) : '',
      hoursBetween(l.timeIn, l.timeOut).toFixed(2),
      deriveStatus(l),
      l.satisfactionRating ?? '',
      l.remarks ?? '', l.contactEmail ?? '', l.contactPhone ?? '',
    ]))
    downloadCsv(`dtc-logbook-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast({ type: 'ok', msg: `Exported ${filtered.length} rows` })
  }

  async function handleCheckout(log: DtcLog, rating: number | null, remarks: string) {
    try {
      await updateLog({
        id: log._id,
        timeOut: new Date().toISOString(),
        satisfactionRating: rating ?? undefined,
        remarks: remarks || undefined,
      })
      toast({ type: 'ok', msg: `Checked out ${log.fullName}` })
      setCheckoutOpen(null)
    } catch (e) {
      toast({ type: 'err', msg: `Checkout failed: ${String(e)}` })
    }
  }

  const activeCount = logs.filter((l) => !l.timeOut).length

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Logbook</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {logs.length} total &middot; {activeCount} active &middot; Updated live
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dtc-btn-ghost" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Icon name="export" size={14} /> Export CSV
          </button>
          <button className="dtc-btn-primary" onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Icon name="plus" size={14} color="#fff" /> New Entry
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="dtc-inp" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, agency, purpose…" style={{ width: '100%' }} />
        </div>
        {['ALL', 'ACTIVE', 'COMPLETED', 'OVERDUE'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid', borderColor: filter === f ? '#0038A8' : '#e5e7eb', background: filter === f ? '#0038A8' : '#fff', color: filter === f ? '#fff' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}>
            {f}
          </button>
        ))}
      </div>

      <div className="dtc-card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>#</th><th>Client</th><th>Agency</th><th>Purpose</th><th>Service</th><th>Time In</th><th>PC</th><th>Duration</th><th>Status</th><th>Rating</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((log, idx) => {
              const status = deriveStatus(log)
              return (
                <tr key={log._id}>
                  <td style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>#{String(idx + 1).padStart(4, '0')}</td>
                  <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelected(log === selected ? null : log)}>{log.fullName}</td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{log.agency}</td>
                  <td style={{ color: '#6b7280', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.purpose}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {log.equipmentUsed.map((e) => <span key={e} className={`dtc-badge ${e === 'Desktop Computer' ? 'dtc-badge-blue' : 'dtc-badge-green'}`} style={{ fontSize: 10 }}>{e === 'Desktop Computer' ? '\uD83D\uDDA5\uFE0F' : '\uD83D\uDCF6'}</span>)}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtTime(log.timeIn)}</td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{log.pc?.name || '\u2014'}</td>
                  <td style={{ color: '#6b7280' }}>{hoursBetween(log.timeIn, log.timeOut).toFixed(1)}h</td>
                  <td>
                    <span className={`dtc-badge ${status === 'ACTIVE' ? 'dtc-badge-green' : status === 'OVERDUE' ? 'dtc-badge-red' : 'dtc-badge-gray'}`} style={{ fontSize: 10 }}>
                      {status === 'ACTIVE' && <span className="dtc-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
                      {status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{log.satisfactionRating ? '\u2B50'.repeat(log.satisfactionRating) : <span style={{ color: '#d1d5db' }}>&mdash;</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!log.timeOut ? (
                        <button className="dtc-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setCheckoutOpen(log)}>Check Out</button>
                      ) : (
                        <button style={{ color: '#9ca3af', padding: 4 }} onClick={() => setSelected(log === selected ? null : log)}><Icon name="eye" size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No entries found. {logs.length === 0 && <button className="dtc-btn-ghost" style={{ color: '#0038A8', marginLeft: 6 }} onClick={() => setAddOpen(true)}>Add one &rarr;</button>}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="dtc-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, background: '#f8faff', border: '1.5px solid #dbeafe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: '#0038A8', fontSize: 14 }}>Entry Detail &mdash; {selected.fullName}</div>
            <button onClick={() => setSelected(null)} style={{ color: '#9ca3af' }}><Icon name="x" size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {([
              ['Full Name', selected.fullName],
              ['Agency', selected.agency],
              ['Purpose', selected.purpose],
              ['Service Type', selected.serviceType],
              ['Equipment', selected.equipmentUsed.join(', ')],
              ['Workstation', selected.pc?.name || '\u2014'],
              ['Time In', fmtTime(selected.timeIn)],
              ['Time Out', selected.timeOut ? fmtTime(selected.timeOut) : 'Still active'],
              ['Duration', `${hoursBetween(selected.timeIn, selected.timeOut).toFixed(2)} hour(s)`],
              ['Planned', `${selected.plannedDurationHours} hour(s)`],
              ['Rating', selected.satisfactionRating ? '\u2B50'.repeat(selected.satisfactionRating) : '—'],
              ['Remarks', selected.remarks || '—'],
              ['Email', selected.contactEmail || '—'],
              ['Phone', selected.contactPhone || '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddLogModal open={addOpen} onClose={() => setAddOpen(false)} pcs={pcs} onSave={async (data) => {
        try {
          await createLog(data)
          toast({ type: 'ok', msg: `Checked in ${data.fullName}` })
          setAddOpen(false)
        } catch (e) { toast({ type: 'err', msg: `Failed: ${String(e)}` }) }
      }} />

      <CheckoutModal log={checkoutOpen} onClose={() => setCheckoutOpen(null)} onSave={handleCheckout} />
      {dialog}
    </div>
  )
}

// ─── Add Log Modal ────────────────────────────────────────────────────────────
function AddLogModal({ open, onClose, pcs, onSave }: {
  open: boolean
  onClose: () => void
  pcs: Array<{ _id: Id<'dtcPcs'>; name: string; status: string }>
  onSave: (data: {
    fullName: string; agency: string; purpose: string; equipmentUsed: string[];
    pcId?: Id<'dtcPcs'>; plannedDurationHours: number; serviceType: string;
    contactEmail?: string; contactPhone?: string;
  }) => Promise<void>
}) {
  const [form, setForm] = useState({
    fullName: '', agency: '', purpose: PURPOSES[0], equipmentUsed: ['Internet Only'] as string[],
    pcId: '' as string, plannedDurationHours: 1, serviceType: SERVICE_TYPES[0],
    contactEmail: '', contactPhone: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({
      fullName: '', agency: '', purpose: PURPOSES[0], equipmentUsed: ['Internet Only'],
      pcId: '', plannedDurationHours: 1, serviceType: SERVICE_TYPES[0],
      contactEmail: '', contactPhone: '',
    })
  }, [open])

  const usesPc = form.equipmentUsed.includes('Desktop Computer')

  async function submit() {
    if (!form.fullName.trim() || !form.agency.trim()) return
    setSaving(true)
    await onSave({
      fullName: form.fullName.trim(),
      agency: form.agency.trim(),
      purpose: form.purpose,
      equipmentUsed: form.equipmentUsed,
      pcId: usesPc && form.pcId ? (form.pcId as Id<'dtcPcs'>) : undefined,
      plannedDurationHours: form.plannedDurationHours,
      serviceType: form.serviceType,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
    })
    setSaving(false)
  }

  const availablePcs = pcs.filter((p) => p.status === 'ONLINE')

  return (
    <Modal open={open} onClose={onClose} title="New Client Check-In" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="dtc-field-label">Full Name *</label>
            <input className="dtc-inp" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Juan dela Cruz" style={{ width: '100%' }} />
          </div>
          <div>
            <label className="dtc-field-label">Agency / Organization *</label>
            <input className="dtc-inp" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} placeholder="LGU Legazpi" style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="dtc-field-label">Purpose</label>
            <select className="dtc-inp" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} style={{ width: '100%' }}>
              {PURPOSES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="dtc-field-label">Service Type</label>
            <select className="dtc-inp" value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))} style={{ width: '100%' }}>
              {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="dtc-field-label">Equipment Used</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Internet Only', 'Desktop Computer'].map((opt) => {
              const checked = form.equipmentUsed.includes(opt)
              return (
                <button key={opt} type="button"
                  onClick={() => setForm((f) => ({ ...f, equipmentUsed: checked ? f.equipmentUsed.filter((x) => x !== opt) : [...f.equipmentUsed, opt] }))}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid',
                    borderColor: checked ? '#0038A8' : '#e5e7eb',
                    background: checked ? '#eff6ff' : '#fff',
                    color: checked ? '#0038A8' : '#6b7280',
                    fontSize: 13, fontWeight: 600, textAlign: 'left',
                  }}>
                  <span style={{ marginRight: 8 }}>{opt === 'Desktop Computer' ? '\uD83D\uDDA5\uFE0F' : '\uD83D\uDCF6'}</span>{opt}
                </button>
              )
            })}
          </div>
        </div>
        {usesPc && (
          <div>
            <label className="dtc-field-label">Assign Workstation</label>
            <select className="dtc-inp" value={form.pcId} onChange={(e) => setForm((f) => ({ ...f, pcId: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Auto / No specific PC —</option>
              {availablePcs.map((p) => <option key={p._id} value={p._id}>{p.name} (available)</option>)}
            </select>
            {availablePcs.length === 0 && <div style={{ fontSize: 11, color: '#d97706', marginTop: 6 }}>No online workstations available right now.</div>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="dtc-field-label">Planned Hours</label>
            <input type="number" min={0.5} max={8} step={0.5} className="dtc-inp" value={form.plannedDurationHours}
              onChange={(e) => setForm((f) => ({ ...f, plannedDurationHours: parseFloat(e.target.value) || 1 }))} style={{ width: '100%' }} />
          </div>
          <div>
            <label className="dtc-field-label">Email (optional)</label>
            <input className="dtc-inp" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div>
            <label className="dtc-field-label">Phone (optional)</label>
            <input className="dtc-inp" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="dtc-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="dtc-btn-primary" onClick={submit} disabled={saving || !form.fullName.trim() || !form.agency.trim() || form.equipmentUsed.length === 0}>
            {saving ? 'Saving…' : 'Check In'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
function CheckoutModal({ log, onClose, onSave }: {
  log: DtcLog | null
  onClose: () => void
  onSave: (log: DtcLog, rating: number | null, remarks: string) => Promise<void>
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [remarks, setRemarks] = useState('')
  useEffect(() => { if (log) { setRating(null); setRemarks('') } }, [log])

  return (
    <Modal open={!!log} onClose={onClose} title={log ? `Check Out — ${log.fullName}` : ''} width={440}>
      {log && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8faff', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
            <div>Checked in <b>{fmtTime(log.timeIn)}</b> &middot; {hoursBetween(log.timeIn).toFixed(1)}h ago</div>
            {log.pc && <div>Workstation: <b>{log.pc.name}</b></div>}
          </div>
          <div>
            <label className="dtc-field-label">Satisfaction Rating</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => setRating(rating === r ? null : r)}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 8, fontSize: 22, border: '1.5px solid', borderColor: rating && r <= rating ? '#d97706' : '#e5e7eb', background: rating && r <= rating ? '#fef3c7' : '#fff', transition: 'all 0.1s' }}>
                  {rating && r <= rating ? '\u2B50' : '\u2606'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="dtc-field-label">Remarks (optional)</label>
            <textarea className="dtc-inp" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} style={{ width: '100%', resize: 'none' }} placeholder="Feedback, issues, notes…" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="dtc-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="dtc-btn-primary" onClick={() => onSave(log, rating, remarks)}>Complete Check-Out</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Workstations Page ────────────────────────────────────────────────────────
type DtcPc = {
  _id: Id<'dtcPcs'>
  name: string
  ipAddress: string
  location?: string
  status: string
  lastSeen?: string
  logs?: Array<{ id: Id<'dtcLogs'>; fullName: string; timeIn: string; plannedDurationHours: number }>
}

const STATUS_COLORS: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
  ONLINE: { bg: '#d1fae5', border: '#6ee7b7', dot: '#059669', text: '#059669', label: 'Available' },
  IN_USE: { bg: '#ffedd5', border: '#fdba74', dot: '#ea580c', text: '#ea580c', label: 'In Use' },
  OFFLINE: { bg: '#f3f4f6', border: '#d1d5db', dot: '#6b7280', text: '#6b7280', label: 'Offline' },
  MAINTENANCE: { bg: '#fef9c3', border: '#fcd34d', dot: '#a16207', text: '#a16207', label: 'Maintenance' },
}

const GRID_STORAGE_KEY = 'dtc-admin-workstation-grid'
const GRID_OPTIONS = [3, 4, 5, 6, 8, 10] as const
const DENSITY_OPTIONS = ['comfy', 'compact'] as const
type Density = typeof DENSITY_OPTIONS[number]

function Workstations() {
  const pcs = (useQuery(api.dtcPcs.getAll) ?? []) as DtcPc[]
  const createPc = useMutation(api.dtcPcs.create)
  const updatePc = useMutation(api.dtcPcs.update)
  const removePc = useMutation(api.dtcPcs.remove)
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const [editing, setEditing] = useState<DtcPc | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [gridCols, setGridCols] = useState<number>(5)
  const [density, setDensity] = useState<Density>('comfy')

  // Restore persisted grid preferences.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(GRID_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (typeof saved.cols === 'number' && GRID_OPTIONS.includes(saved.cols)) setGridCols(saved.cols)
      if (DENSITY_OPTIONS.includes(saved.density)) setDensity(saved.density)
    } catch {}
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify({ cols: gridCols, density }))
  }, [gridCols, density])

  async function changeStatus(pc: DtcPc, status: string) {
    try {
      await updatePc({ id: pc._id, status })
      toast({ type: 'ok', msg: `${pc.name} → ${STATUS_COLORS[status]?.label ?? status}` })
    } catch (e) { toast({ type: 'err', msg: String(e) }) }
  }

  async function handleDelete(pc: DtcPc) {
    const ok = await confirm('Remove workstation?', `Are you sure you want to remove ${pc.name}? This will mark it as inactive.`)
    if (!ok) return
    try {
      await removePc({ id: pc._id })
      toast({ type: 'ok', msg: `Removed ${pc.name}` })
    } catch (e) { toast({ type: 'err', msg: String(e) }) }
  }

  const q = search.trim().toLowerCase()
  const filteredPcs = pcs.filter((pc) => {
    if (filterStatus && pc.status !== filterStatus) return false
    if (!q) return true
    return (
      pc.name.toLowerCase().includes(q) ||
      pc.ipAddress.toLowerCase().includes(q) ||
      (pc.location || '').toLowerCase().includes(q)
    )
  })

  const cardPadding = density === 'compact' ? '10px 10px' : '14px 12px'
  const nameSize = density === 'compact' ? 11 : 13
  const iconSize = density === 'compact' ? 16 : 22
  const showExtras = density === 'comfy'

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Workstations</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{pcs.length} registered &middot; Click a card to edit · Click a status chip to change</div>
        </div>
        <button className="dtc-btn-primary" onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Icon name="plus" size={14} color="#fff" /> Add Workstation
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => {
          const count = pcs.filter((p) => p.status === s).length
          const active = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(active ? null : s)}
              className="dtc-card"
              style={{
                flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left',
                border: active ? `2px solid ${c.dot}` : undefined,
                background: active ? c.bg : undefined,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1f36' }}>{count}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{c.label}</div>
              </div>
            </button>
          )
        })}
        {filterStatus && (
          <button
            onClick={() => setFilterStatus(null)}
            style={{
              fontSize: 11, padding: '6px 12px', borderRadius: 8,
              background: '#f1f3f9', color: '#374151', border: '1px solid #e5e7eb',
              cursor: 'pointer', fontWeight: 600, alignSelf: 'center',
            }}
          >
            Clear filter
          </button>
        )}
      </div>

      {pcs.length === 0 ? (
        <div className="dtc-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🖥️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36' }}>No workstations registered</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Add your first PC to begin tracking usage</div>
          <button className="dtc-btn-primary" onClick={() => setAddOpen(true)} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Icon name="plus" size={14} color="#fff" /> Add Workstation
          </button>
        </div>
      ) : (
        <>
          <div className="dtc-card" style={{ padding: 22 }}>
            {/* Layout controls */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginBottom: 16, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>Floor Layout</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  Showing {filteredPcs.length} of {pcs.length} · {gridCols} columns · {density}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  className="dtc-inp"
                  placeholder="Search name, IP, location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 220, padding: '7px 10px', fontSize: 12 }}
                />
                {/* Density toggle */}
                <div style={{
                  display: 'inline-flex', background: '#f1f3f9', borderRadius: 8, padding: 3,
                  border: '1px solid #e5e7eb',
                }}>
                  {DENSITY_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: density === d ? '#fff' : 'transparent',
                        color: density === d ? '#1a1f36' : '#6b7280',
                        border: 'none', cursor: 'pointer', fontWeight: 600,
                        boxShadow: density === d ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        textTransform: 'capitalize',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {/* Grid column selector */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f3f9',
                  borderRadius: 8, padding: 3, border: '1px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, padding: '0 6px' }}>Cols</span>
                  {GRID_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setGridCols(n)}
                      style={{
                        fontSize: 11, padding: '5px 9px', borderRadius: 6,
                        background: gridCols === n ? '#4338ca' : 'transparent',
                        color: gridCols === n ? '#fff' : '#374151',
                        border: 'none', cursor: 'pointer', fontWeight: 700, minWidth: 24,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredPcs.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                No workstations match the current filter.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gap: density === 'compact' ? 8 : 10,
              }}>
                {filteredPcs.map((pc) => {
                  const c = STATUS_COLORS[pc.status] || STATUS_COLORS.OFFLINE
                  const user = pc.logs?.[0]?.fullName
                  return (
                    <div key={pc._id} onClick={() => setEditing(pc)}
                      style={{
                        background: c.bg, border: `2px solid ${c.border}`,
                        borderRadius: 12, padding: cardPadding, cursor: 'pointer',
                        transition: 'transform 0.12s, box-shadow 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'none';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                      }}
                      title={pc.name + (user ? ` — ${user}` : '')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showExtras ? 8 : 4 }}>
                        <span style={{ fontSize: iconSize }}>{'\uD83D\uDDA5\uFE0F'}</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} className={pc.status === 'ONLINE' ? 'dtc-pulse' : ''} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: nameSize, color: '#1a1f36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.name}</div>
                      {showExtras && (
                        <>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.location || 'No location'}</div>
                          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.7)', padding: '2px 7px', borderRadius: 20 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: c.text }}>{c.label}</span>
                          </div>
                          {user && <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user}</div>}
                          <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#9ca3af' }}>{pc.ipAddress}</div>
                        </>
                      )}
                      {!showExtras && user && (
                        <div style={{ marginTop: 4, fontSize: 9, color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="dtc-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f3f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>PC Registry</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{filteredPcs.length} of {pcs.length}</div>
            </div>
            <table>
              <thead><tr><th>PC Name</th><th>Location</th><th>IP Address</th><th>Status</th><th>Current User</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredPcs.map((pc) => {
                  const c = STATUS_COLORS[pc.status] || STATUS_COLORS.OFFLINE
                  const user = pc.logs?.[0]?.fullName
                  return (
                    <tr key={pc._id}>
                      <td style={{ fontWeight: 600 }}>{pc.name}</td>
                      <td style={{ color: '#6b7280' }}>{pc.location || '—'}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7280' }}>{pc.ipAddress}</td>
                      <td>
                        <select value={pc.status} onChange={(e) => changeStatus(pc, e.target.value)}
                          style={{ background: c.bg, color: c.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                          {Object.entries(STATUS_COLORS).map(([s, v]) => <option key={s} value={s}>{v.label}</option>)}
                        </select>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>{user || '\u2014'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="dtc-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditing(pc)}>Edit</button>
                          <button className="dtc-btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleDelete(pc)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PcModal
        open={addOpen || !!editing}
        editing={editing}
        onClose={() => { setAddOpen(false); setEditing(null) }}
        onSave={async (data) => {
          try {
            if (editing) {
              await updatePc({ id: editing._id, ...data })
              toast({ type: 'ok', msg: `Updated ${data.name}` })
            } else {
              await createPc(data)
              toast({ type: 'ok', msg: `Added ${data.name}` })
            }
            setAddOpen(false); setEditing(null)
          } catch (e) { toast({ type: 'err', msg: String(e) }) }
        }}
      />
      {dialog}
    </div>
  )
}

// ─── PC Add/Edit Modal ────────────────────────────────────────────────────────
function PcModal({ open, editing, onClose, onSave }: {
  open: boolean
  editing: DtcPc | null
  onClose: () => void
  onSave: (data: { name: string; ipAddress: string; location?: string; status?: string }) => Promise<void>
}) {
  const [form, setForm] = useState({ name: '', ipAddress: '', location: '', status: 'ONLINE' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) setForm({ name: editing.name, ipAddress: editing.ipAddress, location: editing.location || '', status: editing.status })
      else setForm({ name: '', ipAddress: '', location: '', status: 'ONLINE' })
    }
  }, [open, editing])

  async function submit() {
    if (!form.name.trim() || !form.ipAddress.trim()) return
    setSaving(true)
    await onSave({
      name: form.name.trim(), ipAddress: form.ipAddress.trim(),
      location: form.location.trim() || undefined, status: form.status,
    })
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add Workstation'} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="dtc-field-label">PC Name *</label>
          <input className="dtc-inp" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="PC-01" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="dtc-field-label">IP Address *</label>
          <input className="dtc-inp" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} placeholder="192.168.1.101" style={{ width: '100%', fontFamily: 'JetBrains Mono, monospace' }} />
        </div>
        <div>
          <label className="dtc-field-label">Location</label>
          <input className="dtc-inp" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Row A — Window side" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="dtc-field-label">Status</label>
          <select className="dtc-inp" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ width: '100%' }}>
            {Object.entries(STATUS_COLORS).map(([s, v]) => <option key={s} value={s}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="dtc-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="dtc-btn-primary" onClick={submit} disabled={saving || !form.name.trim() || !form.ipAddress.trim()}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Announcements Page ───────────────────────────────────────────────────────
type Announcement = {
  _id: Id<'dtcAnnouncements'>
  title: string
  body: string
  type: string
  isActive: boolean
  createdAt: number
  createdBy: string
}

const ANN_TYPE_COLORS: Record<string, string> = { INFO: 'dtc-badge-blue', WARNING: 'dtc-badge-yellow', MAINTENANCE: 'dtc-badge-orange', HOLIDAY: 'dtc-badge-red' }
const ANN_TYPE_ICONS: Record<string, string> = { INFO: '\u2139\uFE0F', WARNING: '\u26A0\uFE0F', MAINTENANCE: '\uD83D\uDD27', HOLIDAY: '\uD83C\uDF89' }

function Announcements() {
  const anns = (useQuery(api.dtcAnnouncements.getAll) ?? []) as Announcement[]
  const createAnn = useMutation(api.dtcAnnouncements.create)
  const updateAnn = useMutation(api.dtcAnnouncements.update)
  const removeAnn = useMutation(api.dtcAnnouncements.remove)
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const [form, setForm] = useState({ title: '', body: '', type: 'INFO' })
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [saving, setSaving] = useState(false)

  async function publish() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateAnn({ id: editing._id, title: form.title.trim(), body: form.body.trim(), type: form.type })
        toast({ type: 'ok', msg: 'Updated announcement' })
      } else {
        await createAnn({ title: form.title.trim(), body: form.body.trim(), type: form.type, createdBy: 'Administrator' })
        toast({ type: 'ok', msg: 'Published announcement' })
      }
      setForm({ title: '', body: '', type: 'INFO' })
      setEditing(null)
    } catch (e) { toast({ type: 'err', msg: String(e) }) }
    setSaving(false)
  }

  function startEdit(a: Announcement) {
    setEditing(a)
    setForm({ title: a.title, body: a.body, type: a.type })
  }

  async function toggleActive(a: Announcement) {
    try { await updateAnn({ id: a._id, isActive: !a.isActive }) }
    catch (e) { toast({ type: 'err', msg: String(e) }) }
  }

  async function handleDelete(a: Announcement) {
    const ok = await confirm('Delete announcement?', `Permanently delete "${a.title}"?`)
    if (!ok) return
    try {
      await removeAnn({ id: a._id })
      toast({ type: 'ok', msg: 'Deleted' })
    } catch (e) { toast({ type: 'err', msg: String(e) }) }
  }

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Announcements</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{anns.filter((a) => a.isActive).length} active &middot; {anns.length} total</div>
        </div>
      </div>

      <div className="dtc-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{editing ? 'Edit Announcement' : 'New Announcement'}</span>
          {editing && <button className="dtc-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditing(null); setForm({ title: '', body: '', type: 'INFO' }) }}>Cancel Edit</button>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="dtc-inp" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Announcement title…" style={{ flex: 2 }} />
          <select className="dtc-inp" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ flex: 1 }}>
            {['INFO', 'WARNING', 'MAINTENANCE', 'HOLIDAY'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <textarea className="dtc-inp" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Optional body text…" rows={2} style={{ resize: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="dtc-btn-primary" onClick={publish} disabled={saving || !form.title.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : <><Icon name="plus" size={14} color="#fff" /> Publish</>}
          </button>
        </div>
      </div>

      {anns.length === 0 ? (
        <div className="dtc-empty dtc-card" style={{ padding: 40 }}>📣 No announcements yet. Create one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {anns.map((ann) => (
            <div key={ann._id} className="dtc-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, opacity: ann.isActive ? 1 : 0.5 }}>
              <span style={{ fontSize: 22 }}>{ANN_TYPE_ICONS[ann.type] ?? '📣'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>{ann.title}</span>
                  <span className={`dtc-badge ${ANN_TYPE_COLORS[ann.type] ?? 'dtc-badge-gray'}`} style={{ fontSize: 10 }}>{ann.type}</span>
                  {ann.isActive && <span className="dtc-badge dtc-badge-green" style={{ fontSize: 10 }}>LIVE</span>}
                </div>
                {ann.body && <div style={{ fontSize: 12, color: '#6b7280' }}>{ann.body}</div>}
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                  {fmtDate(new Date(ann.createdAt).toISOString())} &middot; by {ann.createdBy}
                </div>
              </div>
              <label className="dtc-toggle" title={ann.isActive ? 'Deactivate' : 'Activate'}>
                <input type="checkbox" checked={ann.isActive} onChange={() => toggleActive(ann)} />
                <div className="dtc-toggle-track" />
                <div className="dtc-toggle-thumb" />
              </label>
              <button className="dtc-btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => startEdit(ann)}>Edit</button>
              <button className="dtc-btn-danger" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => handleDelete(ann)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const live = useQuery(api.dtcSettings.getAll)
  const bulkUpdate = useMutation(api.dtcSettings.bulkUpdate)
  const toast = useToast()

  const [settings, setSettings] = useState({
    officeOpen: '08:00', officeClose: '17:00',
    wifiSsid: '', wifiPassword: '', wifiNote: '',
    accessCode: '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (live) {
      setSettings({
        officeOpen: live.officeOpen, officeClose: live.officeClose,
        wifiSsid: live.wifiSsid, wifiPassword: live.wifiPassword, wifiNote: live.wifiNote,
        accessCode: live.accessCode,
      })
      setDirty(false)
    }
  }, [live])

  function update<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await bulkUpdate({ settings, updatedBy: 'Administrator' })
      toast({ type: 'ok', msg: 'Settings saved' })
      setDirty(false)
    } catch (e) { toast({ type: 'err', msg: String(e) }) }
    setSaving(false)
  }

  const S = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f5f7fc', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )

  if (live === undefined) {
    return <div className="dtc-page"><div className="dtc-empty">Loading settings…</div></div>
  }

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Settings</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Shared across all DTC pages {dirty && <span style={{ color: '#d97706', fontWeight: 600 }}>&middot; Unsaved changes</span>}</div>
        </div>
      </div>

      <div className="dtc-card" style={{ padding: '4px 22px' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>Office Hours</div>
        <S label="Opening Time" sub="Clients can log in after this time">
          <input type="time" className="dtc-inp" value={settings.officeOpen} onChange={(e) => update('officeOpen', e.target.value)} />
        </S>
        <S label="Closing Time" sub="Maximum session time is capped here">
          <input type="time" className="dtc-inp" value={settings.officeClose} onChange={(e) => update('officeClose', e.target.value)} />
        </S>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>WiFi Configuration</div>
        <S label="Network SSID" sub="Broadcast name shown to clients">
          <input className="dtc-inp" value={settings.wifiSsid} onChange={(e) => update('wifiSsid', e.target.value)} style={{ width: 240 }} />
        </S>
        <S label="Password" sub="Leave blank for open network">
          <input type="text" className="dtc-inp" value={settings.wifiPassword} onChange={(e) => update('wifiPassword', e.target.value)} style={{ width: 240, fontFamily: 'JetBrains Mono, monospace' }} />
        </S>
        <S label="WiFi Note" sub="Shown on the WiFi info screen">
          <input className="dtc-inp" value={settings.wifiNote} onChange={(e) => update('wifiNote', e.target.value)} style={{ width: 320 }} />
        </S>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>Access Control</div>
        <S label="Admin Access Code" sub="Required to open admin panels on the kiosk">
          <input className="dtc-inp" value={settings.accessCode} onChange={(e) => update('accessCode', e.target.value)} style={{ width: 160, fontFamily: 'JetBrains Mono, monospace' }} />
        </S>

        <div style={{ padding: '16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="dtc-btn-primary" onClick={save} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {saving ? 'Saving…' : !dirty ? 'Saved' : <>Save Changes</>}
          </button>
          {dirty && <button className="dtc-btn-ghost" onClick={() => { if (live) { setSettings({ officeOpen: live.officeOpen, officeClose: live.officeClose, wifiSsid: live.wifiSsid, wifiPassword: live.wifiPassword, wifiNote: live.wifiNote, accessCode: live.accessCode }); setDirty(false) } }}>Discard</button>}
        </div>
      </div>
    </div>
  )
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
function Reports() {
  const logs = (useQuery(api.dtcLogs.getRecent, { limit: 500 }) ?? []) as DtcLog[]
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)

  const todayLogs = useMemo(() => logs.filter((l) => l.timeIn.startsWith(today)), [logs, today])
  const total = logs.length
  const ratings = logs.filter((l) => l.satisfactionRating != null)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + (b.satisfactionRating ?? 0), 0) / ratings.length : 0
  const dist = [5, 4, 3, 2, 1].map((r) => ({ r, count: ratings.filter((l) => l.satisfactionRating === r).length }))

  // Monthly trend for current year
  const monthlyTrend = useMemo(() => {
    const year = new Date().getFullYear()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((m, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, '0')}`
      return { m, v: logs.filter((l) => l.timeIn.startsWith(prefix)).length }
    })
  }, [logs])
  const maxMonthly = Math.max(10, ...monthlyTrend.map((d) => d.v))

  // Today status counts
  const activeCount = todayLogs.filter((l) => deriveStatus(l) === 'ACTIVE').length
  const completedCount = todayLogs.filter((l) => deriveStatus(l) === 'COMPLETED').length
  const overdueCount = todayLogs.filter((l) => deriveStatus(l) === 'OVERDUE').length

  function exportFullReport() {
    const rows: (string | number | null | undefined)[][] = [
      ['DTC — Full Report', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Total Clients', total],
      ['Today — Active', activeCount],
      ['Today — Completed', completedCount],
      ['Today — Overdue', overdueCount],
      ['Average Rating', avgRating.toFixed(2)],
      ['Rated Logs', ratings.length],
      [],
      ['Monthly Trend (current year)'],
      ['Month', 'Visits'],
      ...monthlyTrend.map((d) => [d.m, d.v]),
      [],
      ['All Log Entries'],
      ['Date', 'Full Name', 'Agency', 'Purpose', 'Service', 'Equipment', 'PC', 'Time In', 'Time Out', 'Duration (h)', 'Status', 'Rating', 'Remarks'],
      ...logs.map((l) => [
        fmtDate(l.timeIn), l.fullName, l.agency, l.purpose, l.serviceType,
        l.equipmentUsed.join(' + '), l.pc?.name ?? '',
        fmtTime(l.timeIn), l.timeOut ? fmtTime(l.timeOut) : '',
        hoursBetween(l.timeIn, l.timeOut).toFixed(2),
        deriveStatus(l), l.satisfactionRating ?? '', l.remarks ?? '',
      ]),
    ]
    downloadCsv(`dtc-full-report-${today}.csv`, rows)
    toast({ type: 'ok', msg: 'Full report exported' })
  }

  const serviceBreakdown = [
    { label: 'Desktop Computer Only', count: logs.filter((l) => l.equipmentUsed.includes('Desktop Computer') && !l.equipmentUsed.includes('Internet Only')).length, color: '#0038A8' },
    { label: 'Internet/WiFi Only', count: logs.filter((l) => !l.equipmentUsed.includes('Desktop Computer') && l.equipmentUsed.includes('Internet Only')).length, color: '#6882FF' },
    { label: 'Both Services', count: logs.filter((l) => l.equipmentUsed.includes('Desktop Computer') && l.equipmentUsed.includes('Internet Only')).length, color: '#059669' },
  ]

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Reports &amp; Analytics</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>All-time &middot; {total} total log entries</div>
        </div>
        <button className="dtc-btn-primary" onClick={exportFullReport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Icon name="export" size={14} color="#fff" /> Export Full Report
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Monthly Trend ({new Date().getFullYear()})</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 4 }}>
            {monthlyTrend.map((d) => (
              <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }} title={`${d.m}: ${d.v}`}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', background: d.v > 0 ? '#0038A8' : '#f1f3f9', borderRadius: '4px 4px 0 0', height: d.v > 0 ? `${(d.v / maxMonthly) * 100}%` : '8%', transition: 'height 0.4s', minHeight: d.v > 0 ? 4 : undefined }} />
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>{d.m}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dtc-card" style={{ flex: 0.6, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 4 }}>Satisfaction Score</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Based on {ratings.length} ratings</div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{ratings.length ? avgRating.toFixed(1) : '—'}</div>
            {ratings.length > 0 && <div style={{ fontSize: 22, marginTop: 4 }}>{'\u2B50'.repeat(Math.round(avgRating))}</div>}
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>out of 5.0</div>
          </div>
          {ratings.length > 0 && dist.map(({ r, count }) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#6b7280', width: 14 }}>{r}{'\u2605'}</span>
              <div style={{ flex: 1, height: 7, background: '#f1f3f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(count / ratings.length) * 100}%`, height: '100%', background: '#d97706', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af', width: 14 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Service Breakdown (all-time)</div>
          {total === 0 ? (
            <div className="dtc-empty">No data yet.</div>
          ) : serviceBreakdown.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.label}</div>
              <div style={{ flex: 2, height: 8, background: '#f1f3f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / total) * 100}%`, height: '100%', background: s.color, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 36, textAlign: 'right' }}>{s.count}</div>
            </div>
          ))}
        </div>

        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Today&apos;s Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total Clients Today', value: todayLogs.length, color: '#0038A8' },
              { label: 'Active Now', value: activeCount, color: '#059669' },
              { label: 'Completed Today', value: completedCount, color: '#6b7280' },
              { label: 'Overdue', value: overdueCount, color: '#dc2626' },
            ].map((s) => (
              <div key={s.label} style={{ background: '#f8faff', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CV Station (download + docs) ────────────────────────────────────────────
type CVStationMeta = {
  ok: boolean
  available: boolean
  version?: string
  filename?: string
  sizeMB?: number
  lastModified?: string
  hint?: string
}

function CVStation() {
  const [meta, setMeta] = useState<CVStationMeta | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function loadMeta() {
    setLoadingMeta(true)
    setError(null)
    try {
      const resp = await fetch('/api/cv-station/download?meta=1', { credentials: 'include' })
      if (resp.status === 401) {
        setError('You must be signed in as admin to see the download.')
        setMeta(null)
      } else {
        const data: CVStationMeta = await resp.json()
        setMeta(data)
      }
    } catch (e) {
      setError(String(e))
    }
    setLoadingMeta(false)
  }

  useEffect(() => { loadMeta() }, [])

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      const resp = await fetch('/api/cv-station/download', { credentials: 'include' })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error(j.error || `HTTP ${resp.status}`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = meta?.filename || 'DICT-FaceCheckin.exe'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e))
    }
    setDownloading(false)
  }

  async function handleUpload(file: File) {
    setError(null); setOk(null)
    if (!/\.exe$/i.test(file.name)) {
      setError('Only .exe files are accepted.')
      return
    }
    setUploading(true)
    setUploadPct(0)
    const form = new FormData()
    form.append('file', file)
    try {
      // XHR (rather than fetch) so we can stream an upload progress bar.
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/cv-station/upload')
        xhr.withCredentials = true
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText || '{}')
            if (xhr.status >= 200 && xhr.status < 300) resolve(j)
            else reject(new Error(j?.error || `HTTP ${xhr.status}`))
          } catch { reject(new Error(`HTTP ${xhr.status}`)) }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(form)
      })
      setOk(`Uploaded ${result.filename} (${result.sizeMB} MB)`)
      toast({ type: 'ok', msg: `Uploaded ${result.filename}` })
      await loadMeta()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setUploading(false)
      setUploadPct(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemoveBuild() {
    if (!confirm('Remove the current build from the server?')) return
    setRemoving(true); setError(null); setOk(null)
    try {
      const resp = await fetch('/api/cv-station/upload', { method: 'DELETE', credentials: 'include' })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(j?.error || `HTTP ${resp.status}`)
      toast({ type: 'ok', msg: 'Build removed' })
      await loadMeta()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setRemoving(false)
    }
  }

  const available = !!meta?.available

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>CV Station — Desktop App</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Face-recognition attendance client for Windows workstations
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700,
            padding: '5px 10px', borderRadius: 20,
            background: available ? '#d1fae5' : '#fef3c7',
            color: available ? '#059669' : '#92400e',
            border: `1px solid ${available ? '#6ee7b7' : '#fde68a'}`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: available ? '#059669' : '#d97706',
            }} className={available ? 'dtc-pulse' : ''} />
            {loadingMeta ? 'Checking…' : available ? 'Build ready' : 'No build on server'}
          </span>
          <button
            onClick={loadMeta}
            style={{
              fontSize: 11, padding: '6px 12px', borderRadius: 8,
              background: '#f1f3f9', color: '#374151', border: '1px solid #e5e7eb',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Primary row: download / upload side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14 }}>
        {/* ── Download card — always visible, primary CTA ── */}
        <div className="dtc-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="download" size={22} color="#4338ca" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36' }}>Download DICT-FaceCheckin.exe</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Admin-only · streams from <code>downloads/</code></div>
            </div>
          </div>

          {available ? (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              background: '#f8faff', padding: 14, borderRadius: 10,
            }}>
              <Kv k="Filename" v={meta?.filename ?? '—'} />
              <Kv k="Version" v={meta?.version ?? '—'} />
              <Kv k="Size" v={meta?.sizeMB != null ? `${meta.sizeMB} MB` : '—'} />
              <Kv k="Built" v={meta?.lastModified ? new Date(meta.lastModified).toLocaleString() : '—'} />
            </div>
          ) : (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
              padding: 14, fontSize: 12, color: '#92400e', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No build uploaded yet</div>
              <div>Build it on a Windows machine, then upload it using the panel on the right — it'll appear here immediately.</div>
            </div>
          )}

          <button
            className="dtc-btn-primary"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, fontSize: 13, opacity: available ? 1 : 0.5, cursor: available ? 'pointer' : 'not-allowed',
            }}
            onClick={handleDownload}
            disabled={!available || downloading}
            title={!available ? 'Upload a build first' : ''}
          >
            <Icon name="download" size={14} color="#fff" />
            {downloading ? 'Downloading…' : 'Download CV Station (.exe)'}
          </button>

          {available && (
            <button
              onClick={handleRemoveBuild}
              disabled={removing}
              style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 8,
                background: 'transparent', color: '#dc2626', border: '1px solid #fecaca',
                cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start',
              }}
            >
              {removing ? 'Removing…' : 'Remove current build'}
            </button>
          )}
        </div>

        {/* ── Upload card — drag/drop + pick button ── */}
        <div
          className="dtc-card"
          style={{
            padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
            border: dragActive ? '2px dashed #4338ca' : undefined,
            background: dragActive ? '#eef2ff' : undefined,
            transition: 'all 0.15s',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleUpload(f)
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: '#ede9fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="plus" size={22} color="#7c3aed" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36' }}>Upload a new build</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Drag a <code>.exe</code> here, or pick one below</div>
            </div>
          </div>

          <div style={{
            border: '2px dashed #d1d5db', borderRadius: 12, padding: 20,
            textAlign: 'center', background: dragActive ? 'transparent' : '#fafbff',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📦</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              Drop <b>DICT-FaceCheckin.exe</b> here
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".exe,application/vnd.microsoft.portable-executable"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <button
              className="dtc-btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? `Uploading… ${uploadPct}%` : 'Choose .exe file'}
            </button>
            {uploading && (
              <div style={{ marginTop: 10, background: '#e5e7eb', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${uploadPct}%`, background: '#4338ca', height: '100%', transition: 'width 0.15s' }} />
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
            Build on Windows: <code style={{ background: '#f1f3f9', padding: '1px 5px', borderRadius: 3 }}>cv-station/build.bat</code>.
            The resulting <code>dist/DICT-FaceCheckin.exe</code> can be uploaded here.
          </div>
        </div>
      </div>

      {/* Status messages */}
      {(error || ok) && (
        <div style={{
          padding: 10, borderRadius: 8, fontSize: 12,
          background: error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${error ? '#fecaca' : '#86efac'}`,
          color: error ? '#991b1b' : '#166534',
        }}>
          {error || ok}
        </div>
      )}

      {/* Secondary row: setup + verification */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="dtc-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 12 }}>
            Setup on a new PC
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
            <li>Download <b>DICT-FaceCheckin.exe</b> using the button above.</li>
            <li>Copy the file to the target PC (USB stick, shared drive, etc.).</li>
            <li>Double-click. Windows may warn "unrecognized app" — choose <b>More info → Run anyway</b>.</li>
            <li>The <b>Setup Wizard</b> opens. Enter the <b>Server URL</b> and <b>API Key</b>, then click <b>Test Connection</b>.</li>
            <li>Four checks run: web app, API key, Convex, Google Sheets. All four must pass before <b>Save &amp; Launch</b> enables.</li>
            <li>In the app, go to <b>⚙️ Settings</b> and toggle <b>Run on Windows startup</b> if desired.</li>
          </ol>
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            fontSize: 11, color: '#1e40af', lineHeight: 1.6,
          }}>
            <b>Security:</b> The API key is stored at <code>%APPDATA%\DICT-FaceCheckin\config.json</code> encrypted via Windows DPAPI — tied to the Windows user account. Copying the config file to another PC won't leak the key.
          </div>
        </div>

        <div className="dtc-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 10 }}>
            How verification works
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
            Every setup call hits <code>POST /api/cv-station/verify</code>. The endpoint confirms all four sync dependencies before the .exe can be saved as configured.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { t: 'Web app', d: 'Reachable from the client' },
              { t: 'API key',  d: 'Matches server FACE_CV_API_KEY' },
              { t: 'Convex',   d: 'Interns table query returns' },
              { t: 'Sheets',   d: 'Service account can read each sheet' },
            ].map((c) => (
              <div key={c.t} style={{ background: '#f8faff', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1f36' }}>{c.t}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Invites Page ────────────────────────────────────────────────────────────
type InviteRow = {
  id: string
  email: string
  role: 'intern' | 'supervisor' | 'manager' | 'admin'
  token: string
  createdAt: number
  expiresAt: number
  usedAt?: number
  status: 'pending' | 'used' | 'expired'
}

function InvitesPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'intern' | 'supervisor' | 'manager' | 'admin'>('intern')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string; link?: string } | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'used' | 'expired'>('all')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function acceptUrl(token: string): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`
  }

  async function copyToClipboard(text: string, tagId: string | null = null) {
    try {
      await navigator.clipboard.writeText(text)
      if (tagId !== null) {
        setCopiedId(tagId)
        setTimeout(() => setCopiedId((c) => (c === tagId ? null : c)), 1800)
      }
      return true
    } catch {
      // Fallback: textarea + execCommand
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        if (tagId !== null) {
          setCopiedId(tagId)
          setTimeout(() => setCopiedId((c) => (c === tagId ? null : c)), 1800)
        }
        return true
      } catch {
        return false
      }
    }
  }

  async function loadInvites() {
    setLoadingList(true)
    try {
      const resp = await fetch('/api/auth/invite/list', { credentials: 'include' })
      if (resp.ok) {
        const data = await resp.json()
        setInvites(data.invites ?? [])
      } else {
        setInvites([])
      }
    } catch {
      setInvites([])
    }
    setLoadingList(false)
  }

  useEffect(() => { loadInvites() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    const clean = email.trim().toLowerCase()
    if (!clean) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMsg({ kind: 'err', text: 'Please enter a valid email address' })
      return
    }
    setSending(true)
    try {
      const resp = await fetch('/api/auth/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: clean, role }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`)
      if (data.emailSent) {
        setMsg({
          kind: 'ok',
          text: `Invite emailed to ${clean}. Link also available below — share it manually if needed.`,
          link: data.acceptUrl,
        })
      } else {
        setMsg({
          kind: 'warn',
          text: `Invite created, but the email could not be sent${data.emailError ? `: ${data.emailError}` : '.'} Copy the link below and share it directly.`,
          link: data.acceptUrl,
        })
      }
      setEmail('')
      loadInvites()
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message || 'Failed to send invite' })
    }
    setSending(false)
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this invite? The link will stop working immediately.')) return
    setBusyId(id)
    try {
      const resp = await fetch('/api/auth/invite/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteId: id }),
      })
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}))
        throw new Error(d.error || 'Revoke failed')
      }
      loadInvites()
    } catch (e: any) {
      alert(e.message || 'Revoke failed')
    }
    setBusyId(null)
  }

  async function resend(id: string, emailTo: string) {
    setBusyId(id)
    setMsg(null)
    try {
      const resp = await fetch('/api/auth/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteId: id }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error || 'Resend failed')
      if (data.emailSent) {
        setMsg({ kind: 'ok', text: `Re-sent invite to ${emailTo}. Expiry extended by 7 days.`, link: data.acceptUrl })
      } else {
        setMsg({
          kind: 'warn',
          text: `Could not re-send email${data.emailError ? `: ${data.emailError}` : '.'} Link below is still valid.`,
          link: data.acceptUrl,
        })
      }
      loadInvites()
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message || 'Resend failed' })
    }
    setBusyId(null)
  }

  // Stats + filtered view
  const stats = {
    total: invites.length,
    pending: invites.filter((i) => i.status === 'pending').length,
    used: invites.filter((i) => i.status === 'used').length,
    expired: invites.filter((i) => i.status === 'expired').length,
  }
  const visible = invites.filter((inv) => {
    if (filter !== 'all' && inv.status !== filter) return false
    if (search && !inv.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function fmtDate(t: number | undefined): string {
    if (!t) return '—'
    return new Date(t).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }
  function daysUntil(t: number): number {
    return Math.max(0, Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)))
  }

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Invites</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Send one-time account invitations. Links are valid for 7 days.
          </div>
        </div>
        <button
          onClick={loadInvites}
          disabled={loadingList}
          style={{
            fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff', color: '#374151',
            cursor: loadingList ? 'wait' : 'pointer',
          }}
        >
          {loadingList ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { k: 'all', lbl: 'Total', n: stats.total, bg: '#eef2ff', col: '#4338ca' },
          { k: 'pending', lbl: 'Pending', n: stats.pending, bg: '#fef3c7', col: '#92400e' },
          { k: 'used', lbl: 'Accepted', n: stats.used, bg: '#d1fae5', col: '#065f46' },
          { k: 'expired', lbl: 'Expired', n: stats.expired, bg: '#fee2e2', col: '#991b1b' },
        ].map((s) => (
          <button
            key={s.k}
            onClick={() => setFilter(s.k as any)}
            style={{
              background: filter === s.k ? s.bg : '#fff',
              border: `1px solid ${filter === s.k ? s.col : '#e5e7eb'}`,
              borderRadius: 10, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: filter === s.k ? `0 0 0 3px ${s.bg}` : 'none',
              transition: 'all 120ms ease',
            }}
          >
            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>
              {s.lbl}
            </span>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.col }}>{s.n}</span>
          </button>
        ))}
      </div>

      {/* Send card */}
      <div className="dtc-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="mail" size={22} color="#4338ca" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36' }}>Send an invite</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Recipient receives an email with the accept link. They'll verify with a one-time code on sign-up.
            </div>
          </div>
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              autoComplete="off"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #e5e7eb', fontSize: 13, marginTop: 4,
              }}
              required
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #e5e7eb', fontSize: 13, marginTop: 4, background: '#fff',
              }}
            >
              <option value="intern">Intern</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            className="dtc-btn-primary"
            style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            disabled={sending}
          >
            <Icon name="plus" size={14} color="#fff" />
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </form>

        {msg && (
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 8, fontSize: 12,
            background:
              msg.kind === 'ok' ? '#ecfdf5' :
              msg.kind === 'warn' ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${
              msg.kind === 'ok' ? '#a7f3d0' :
              msg.kind === 'warn' ? '#fde68a' : '#fecaca'
            }`,
            color:
              msg.kind === 'ok' ? '#065f46' :
              msg.kind === 'warn' ? '#92400e' : '#991b1b',
          }}>
            <div style={{ fontWeight: 600 }}>{msg.text}</div>
            {msg.link && (
              <div style={{
                marginTop: 8, display: 'flex', gap: 8, alignItems: 'center',
                padding: '8px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 6,
              }}>
                <code style={{
                  fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace',
                  color: '#1a1f36', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{msg.link}</code>
                <button
                  onClick={() => copyToClipboard(msg.link!, '__msg__')}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: '#1a1f36', color: '#fff', border: 'none',
                    cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  {copiedId === '__msg__' ? '✓ Copied' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invites list */}
      <div className="dtc-card" style={{ padding: 22 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, flexWrap: 'wrap', marginBottom: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>
            {filter === 'all' ? 'All invites' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} invites`}
            {visible.length > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: '#6b7280' }}>
                ({visible.length})
              </span>
            )}
          </div>
          <input
            type="search"
            placeholder="Search by email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
              fontSize: 12, minWidth: 220,
            }}
          />
        </div>

        {loadingList ? (
          <div style={{ fontSize: 12, color: '#6b7280', padding: 16, textAlign: 'center' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{
            fontSize: 13, color: '#6b7280', padding: '24px 16px', textAlign: 'center',
            background: '#f8faff', borderRadius: 8, border: '1px dashed #e5e7eb',
          }}>
            {invites.length === 0
              ? 'No invites yet. Send one above to get started.'
              : 'No invites match this filter.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((inv) => {
              const link = acceptUrl(inv.token)
              const daysLeft = daysUntil(inv.expiresAt)
              return (
                <div key={inv.id} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 100px 110px 130px auto',
                  gap: 12, alignItems: 'center', padding: '12px 14px',
                  background: '#f8faff', borderRadius: 8, fontSize: 12,
                  border: '1px solid #eef2ff',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#1a1f36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.email}
                    </div>
                    {inv.status === 'pending' && (
                      <div style={{
                        marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 10, color: '#6b7280',
                      }}>
                        <code style={{
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1, minWidth: 0,
                        }}>{link}</code>
                        <button
                          onClick={() => copyToClipboard(link, inv.id)}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            background: copiedId === inv.id ? '#d1fae5' : '#fff',
                            color: copiedId === inv.id ? '#065f46' : '#374151',
                            border: `1px solid ${copiedId === inv.id ? '#a7f3d0' : '#e5e7eb'}`,
                            cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                          }}
                        >
                          {copiedId === inv.id ? '✓' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#374151', textTransform: 'capitalize', fontWeight: 600 }}>{inv.role}</div>
                  <div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background:
                        inv.status === 'used' ? '#d1fae5' :
                        inv.status === 'expired' ? '#fee2e2' : '#fef3c7',
                      color:
                        inv.status === 'used' ? '#065f46' :
                        inv.status === 'expired' ? '#991b1b' : '#92400e',
                    }}>{inv.status === 'used' ? 'Accepted' : inv.status}</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {inv.status === 'used' ? (
                      <>Accepted {fmtDate(inv.usedAt)}</>
                    ) : inv.status === 'pending' ? (
                      <>Expires in {daysLeft}d</>
                    ) : (
                      <>Expired {fmtDate(inv.expiresAt)}</>
                    )}
                    <div style={{ fontSize: 10, opacity: 0.7 }}>Sent {fmtDate(inv.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {inv.status === 'pending' && (
                      <>
                        <button
                          onClick={() => resend(inv.id, inv.email)}
                          disabled={busyId === inv.id}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6,
                            background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe',
                            cursor: busyId === inv.id ? 'wait' : 'pointer', fontWeight: 600,
                          }}
                          title="Re-email and extend expiry"
                        >
                          {busyId === inv.id ? '…' : 'Resend'}
                        </button>
                        <button
                          onClick={() => revoke(inv.id)}
                          disabled={busyId === inv.id}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6,
                            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
                            cursor: busyId === inv.id ? 'wait' : 'pointer', fontWeight: 600,
                          }}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
      <div style={{ fontSize: 13, color: '#1a1f36', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>{v}</div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
type Tweaks = { sidebarColor: string; accentColor: string; compactMode: boolean }

const TWEAK_DEFAULTS: Tweaks = {
  sidebarColor: '#1B1B2F',
  accentColor: '#7c3aed',
  compactMode: true,
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', section: 'Overview' },
  { id: 'logbook', label: 'Logbook', icon: 'logbook', section: 'Manage' },
  { id: 'workstations', label: 'Workstations', icon: 'pc', section: null },
  { id: 'announcements', label: 'Announcements', icon: 'announce', section: null },
  { id: 'reports', label: 'Reports', icon: 'reports', section: 'Analytics' },
  { id: 'cvstation', label: 'CV Station', icon: 'camera', section: 'Devices' },
  { id: 'invites', label: 'Invites', icon: 'mail', section: 'Users' },
  { id: 'settings', label: 'Settings', icon: 'settings', section: null },
]

export default function DTCAdminPage() {
  return (
    <ToastProvider>
      <DTCAdminInner />
    </ToastProvider>
  )
}

function DTCAdminInner() {
  const [page, setPage] = useState('dashboard')
  const [now, setNow] = useState(new Date())
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS)
  const [showTweaks, setShowTweaks] = useState(false)

  // Live badges in sidebar
  const activeSessions = useQuery(api.dtcLogs.getActiveSessions) ?? []
  const activeAnnouncements = useQuery(api.dtcAnnouncements.getActive) ?? []

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === '__activate_edit_mode') setShowTweaks(true)
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false)
    }
    window.addEventListener('message', handler)
    window.parent.postMessage({ type: '__edit_mode_available' }, '*')
    return () => window.removeEventListener('message', handler)
  }, [])

  const applyTweak = (key: keyof Tweaks, val: string | boolean) => {
    const next = { ...tweaks, [key]: val }
    setTweaks(next)
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*')
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />
      case 'logbook': return <Logbook />
      case 'workstations': return <Workstations />
      case 'announcements': return <Announcements />
      case 'reports': return <Reports />
      case 'cvstation': return <CVStation />
      case 'invites': return <InvitesPage />
      case 'settings': return <SettingsPage />
      default: return <Dashboard onNavigate={setPage} />
    }
  }
  const fmt = (d: Date) => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="dtc-admin-root">
      <div className="dtc-app">
        {/* Sidebar */}
        <div className="dtc-sidebar" style={{ background: tweaks.sidebarColor }}>
          {/* PH Flag stripe */}
          <div style={{ height: 3, display: 'flex', flexShrink: 0 }}>
            <div style={{ flex: 1, background: tweaks.accentColor }} />
            <div style={{ flex: 1, background: '#CE1126' }} />
            <div style={{ flex: 1, background: '#FCD116' }} />
          </div>

          <div className="dtc-sidebar-logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{'\uD83C\uDFDB\uFE0F'}</div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>DTC Admin</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>DICT Region V</div>
              </div>
            </div>
          </div>

          <nav className="dtc-sidebar-nav">
            {NAV_ITEMS.map((item, i) => {
              const prevSection = i > 0 ? NAV_ITEMS[i - 1].section : null
              const liveBadge: number | null =
                item.id === 'logbook' ? activeSessions.length :
                item.id === 'announcements' ? activeAnnouncements.length :
                null
              const showBadge = liveBadge !== null && liveBadge > 0
              return (
                <Fragment key={item.id}>
                  {item.section && item.section !== prevSection && (
                    <div className="dtc-nav-section-label">{item.section}</div>
                  )}
                  <div className={`dtc-nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}
                    style={page === item.id ? { background: `${tweaks.accentColor}30` } : {}}>
                    <span className="dtc-nav-icon"><Icon name={item.icon} size={15} color={page === item.id ? '#fff' : 'rgba(255,255,255,0.5)'} /></span>
                    <span>{item.label}</span>
                    {showBadge && <span style={{ background: item.id === 'logbook' ? '#059669' : '#CE1126', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginLeft: 'auto' }}>{liveBadge}</span>}
                    {!showBadge && <div className="dtc-nav-dot" />}
                  </div>
                </Fragment>
              )
            })}
          </nav>

          <div className="dtc-sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="user" size={14} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Administrator</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>dict-region5</div>
              </div>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, width: '100%', padding: '6px 2px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
              <Icon name="logout" size={13} color="currentColor" /> Sign Out
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="dtc-main">
          <div className="dtc-topbar">
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36', textTransform: 'capitalize' }}>{page.replace('-', ' ')}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: '#374151', background: '#f5f7fa', padding: '5px 12px', borderRadius: 8 }}>
                {fmt(now)}
              </div>
              <div style={{ position: 'relative' }}>
                <button style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                  <Icon name="bell" size={16} />
                </button>
                <div className="dtc-notif-dot" />
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: tweaks.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user" size={16} color="#fff" />
              </div>
            </div>
          </div>

          <div className="dtc-content">
            {renderPage()}
          </div>
        </div>

        {/* Tweaks Panel */}
        {showTweaks && (
          <div className="dtc-tweaks-panel">
            <h4>Tweaks</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>Sidebar Color</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {['#0D1B3E','#1a1a2e','#0f2027','#1B1B2F','#0a192f'].map(c => (
                    <div key={c} onClick={() => applyTweak('sidebarColor', c)}
                      style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: tweaks.sidebarColor === c ? '2px solid #0038A8' : '2px solid transparent', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>Accent Color</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {['#0038A8','#2563eb','#7c3aed','#059669','#dc2626'].map(c => (
                    <div key={c} onClick={() => applyTweak('accentColor', c)}
                      style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: tweaks.accentColor === c ? '2px solid #000' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Compact Mode</div>
                <label className="dtc-toggle">
                  <input type="checkbox" checked={tweaks.compactMode} onChange={e => applyTweak('compactMode', e.target.checked)} />
                  <div className="dtc-toggle-track" /><div className="dtc-toggle-thumb" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
