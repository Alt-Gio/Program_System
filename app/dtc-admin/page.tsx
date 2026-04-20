'use client'

import { useState, useEffect, Fragment } from 'react'
import './dtc-admin.css'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_LOGS = [
  { id: 1, fullName: 'Maria Santos', agency: 'LGU Legazpi', purpose: 'Online Job Application', equipment: ['Desktop Computer'], timeIn: '08:12 AM', timeOut: '10:12 AM', duration: 2, status: 'COMPLETED', rating: 5, pc: 'PC-01' },
  { id: 2, fullName: 'Juan dela Cruz', agency: 'DepEd Sorsogon', purpose: 'Government Transaction', equipment: ['Internet Only'], timeIn: '08:35 AM', timeOut: null, duration: 1, status: 'ACTIVE', rating: null, pc: null },
  { id: 3, fullName: 'Ana Reyes', agency: 'SSS', purpose: 'SSS Online Transaction', equipment: ['Desktop Computer', 'Internet Only'], timeIn: '09:00 AM', timeOut: '11:00 AM', duration: 2, status: 'COMPLETED', rating: 4, pc: 'PC-03' },
  { id: 4, fullName: 'Roberto Lim', agency: 'Private Individual', purpose: 'Freelance Work', equipment: ['Desktop Computer'], timeIn: '09:20 AM', timeOut: null, duration: 3, status: 'ACTIVE', rating: null, pc: 'PC-02' },
  { id: 5, fullName: 'Carla Mendoza', agency: 'DICT Albay', purpose: 'Digital Literacy / Learning', equipment: ['Desktop Computer'], timeIn: '09:45 AM', timeOut: '10:45 AM', duration: 1, status: 'COMPLETED', rating: 5, pc: 'PC-04' },
  { id: 6, fullName: 'Eduardo Torres', agency: 'PhilHealth', purpose: 'PhilHealth Online Transaction', equipment: ['Internet Only'], timeIn: '10:00 AM', timeOut: null, duration: 1.5, status: 'ACTIVE', rating: null, pc: null },
  { id: 7, fullName: 'Liza Bautista', agency: 'BIR Legazpi', purpose: 'Online Business Transaction', equipment: ['Desktop Computer'], timeIn: '10:15 AM', timeOut: '12:15 PM', duration: 2, status: 'COMPLETED', rating: 3, pc: 'PC-05' },
  { id: 8, fullName: 'Marco Villanueva', agency: 'State University', purpose: 'Online Scholarship Application', equipment: ['Desktop Computer'], timeIn: '10:30 AM', timeOut: null, duration: 2, status: 'OVERDUE', rating: null, pc: 'PC-06' },
  { id: 9, fullName: 'Sophia Garcia', agency: 'DSWD', purpose: 'Email and Communication', equipment: ['Internet Only'], timeIn: '11:00 AM', timeOut: '11:30 AM', duration: 0.5, status: 'COMPLETED', rating: 5, pc: null },
  { id: 10, fullName: 'Kenneth Abad', agency: 'LGU Daraga', purpose: 'Resume / CV Preparation', equipment: ['Desktop Computer'], timeIn: '11:15 AM', timeOut: null, duration: 1, status: 'ACTIVE', rating: null, pc: 'PC-07' },
]

const MOCK_PCS = [
  { id: 'PC-01', name: 'PC-01', location: 'Row A', status: 'ONLINE', ip: '192.168.1.101', user: '' },
  { id: 'PC-02', name: 'PC-02', location: 'Row A', status: 'IN_USE', ip: '192.168.1.102', user: 'Roberto Lim' },
  { id: 'PC-03', name: 'PC-03', location: 'Row A', status: 'ONLINE', ip: '192.168.1.103', user: '' },
  { id: 'PC-04', name: 'PC-04', location: 'Row A', status: 'ONLINE', ip: '192.168.1.104', user: '' },
  { id: 'PC-05', name: 'PC-05', location: 'Row A', status: 'MAINTENANCE', ip: '192.168.1.105', user: '' },
  { id: 'PC-06', name: 'PC-06', location: 'Row B', status: 'IN_USE', ip: '192.168.1.106', user: 'Marco V.' },
  { id: 'PC-07', name: 'PC-07', location: 'Row B', status: 'IN_USE', ip: '192.168.1.107', user: 'Kenneth A.' },
  { id: 'PC-08', name: 'PC-08', location: 'Row B', status: 'ONLINE', ip: '192.168.1.108', user: '' },
  { id: 'PC-09', name: 'PC-09', location: 'Row B', status: 'OFFLINE', ip: '192.168.1.109', user: '' },
  { id: 'PC-10', name: 'PC-10', location: 'Row B', status: 'ONLINE', ip: '192.168.1.110', user: '' },
]

const CHART_DATA = [
  { day: 'Mon', pc: 28, wifi: 14 },
  { day: 'Tue', pc: 35, wifi: 18 },
  { day: 'Wed', pc: 42, wifi: 22 },
  { day: 'Thu', pc: 31, wifi: 16 },
  { day: 'Fri', pc: 48, wifi: 25 },
  { day: 'Sat', pc: 20, wifi: 9 },
  { day: 'Sun', pc: 12, wifi: 5 },
]

const MAX_CHART = 60

const INITIAL_ANNOUNCEMENTS = [
  { id: 1, title: 'System Maintenance', body: 'PC-05 under maintenance until further notice.', type: 'MAINTENANCE', active: true, created: 'Apr 19, 2026' },
  { id: 2, title: 'Holiday Notice', body: 'Office closed on April 25 — Araw ng Kagitingan.', type: 'HOLIDAY', active: false, created: 'Apr 18, 2026' },
  { id: 3, title: 'New WiFi Password', body: 'WiFi password updated. See front desk for credentials.', type: 'INFO', active: true, created: 'Apr 17, 2026' },
]

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
function Dashboard() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const activeToday = MOCK_LOGS.filter(l => l.status === 'ACTIVE').length
  const completedToday = MOCK_LOGS.filter(l => l.status === 'COMPLETED').length
  const ratedLogs = MOCK_LOGS.filter(l => l.rating != null)
  const avgRating = (ratedLogs.reduce((a, b) => a + (b.rating ?? 0), 0) / ratedLogs.length).toFixed(1)
  const pcInUse = MOCK_PCS.filter(p => p.status === 'IN_USE').length

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard label="Active Sessions" value={activeToday} sub="Live right now" icon="user" color="#0038A8" spark={[3,5,4,6,5,4,activeToday]} trend={12} />
        <StatCard label="Completed Today" value={completedToday} sub="Since 8:00 AM" icon="check" color="#059669" spark={[8,12,10,15,14,12,completedToday]} trend={8} />
        <StatCard label="PCs In Use" value={`${pcInUse}/${MOCK_PCS.length}`} sub="Workstations" icon="pc" color="#7c3aed" spark={[4,6,5,7,6,5,pcInUse]} trend={-5} />
        <StatCard label="Avg. Rating" value={`${avgRating}\u2605`} sub="Today's feedback" icon="trend" color="#d97706" spark={[4,4.5,4.2,4.8,4.6,4.7,parseFloat(avgRating)]} trend={3} />
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {/* Weekly Chart */}
        <div className="dtc-card" style={{ flex: 1.4, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Weekly Visitors</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>April 14 &ndash; 20, 2026</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#0038A8', display: 'inline-block' }} />Desktop</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#6882FF', display: 'inline-block' }} />WiFi</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 4 }}>
            {CHART_DATA.map((d, i) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}
                onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, position: 'relative' }}>
                  {hoveredBar === i && (
                    <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: '#1a1f36', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 10 }}>
                      PC: {d.pc} &middot; WiFi: {d.wifi}
                    </div>
                  )}
                  <div style={{ flex: 1, background: hoveredBar === i ? '#0038A8' : '#0038A8cc', borderRadius: '4px 4px 0 0', height: `${(d.pc / MAX_CHART) * 100}%`, transition: 'all 0.2s' }} />
                  <div style={{ flex: 1, background: hoveredBar === i ? '#6882FF' : '#6882FFaa', borderRadius: '4px 4px 0 0', height: `${(d.wifi / MAX_CHART) * 100}%`, transition: 'all 0.2s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{d.day}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, padding: '12px 14px', background: '#f8faff', borderRadius: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0038A8' }}>{CHART_DATA.reduce((a,b) => a+b.pc,0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>PC Sessions</div>
            </div>
            <div style={{ width: 1, background: '#e5e7eb' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#6882FF' }}>{CHART_DATA.reduce((a,b) => a+b.wifi,0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>WiFi Sessions</div>
            </div>
            <div style={{ width: 1, background: '#e5e7eb' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{CHART_DATA.reduce((a,b) => a+b.pc+b.wifi,0)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Total</div>
            </div>
          </div>
        </div>

        {/* PC Status */}
        <div className="dtc-card" style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 4 }}>Workstation Status</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Live overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, flex: 1 }}>
            {MOCK_PCS.map(pc => {
              const colors: Record<string, { bg: string; border: string; dot: string }> = {
                ONLINE: { bg: '#d1fae5', border: '#6ee7b7', dot: '#059669' },
                IN_USE: { bg: '#ffedd5', border: '#fcd34d', dot: '#d97706' },
                OFFLINE: { bg: '#f3f4f6', border: '#d1d5db', dot: '#9ca3af' },
                MAINTENANCE: { bg: '#fef3c7', border: '#fcd34d', dot: '#d97706' },
              }
              const c = colors[pc.status] || colors.OFFLINE
              return (
                <div key={pc.id} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  title={pc.status === 'IN_USE' ? `${pc.name} \u2014 ${pc.user}` : pc.name}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{pc.name}</div>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, margin: '4px auto 0' }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {([
              { label: 'Available', color: '#059669', count: MOCK_PCS.filter(p=>p.status==='ONLINE').length },
              { label: 'In Use', color: '#d97706', count: MOCK_PCS.filter(p=>p.status==='IN_USE').length },
              { label: 'Offline', color: '#9ca3af', count: MOCK_PCS.filter(p=>p.status==='OFFLINE').length },
              { label: 'Maint.', color: '#d97706', count: MOCK_PCS.filter(p=>p.status==='MAINTENANCE').length },
            ]).map(s => (
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
          <button className="dtc-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Icon name="eye" size={13} /> View All
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Agency</th><th>Service</th><th>Time In</th><th>Duration</th><th>Status</th><th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LOGS.slice(0, 6).map(log => (
              <tr key={log.id}>
                <td style={{ fontWeight: 600, color: '#1a1f36' }}>{log.fullName}</td>
                <td style={{ color: '#6b7280' }}>{log.agency}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {log.equipment.map(e => (
                      <span key={e} className="dtc-badge dtc-badge-blue" style={{ fontSize: 10 }}>{e === 'Desktop Computer' ? '\uD83D\uDDA5\uFE0F PC' : '\uD83D\uDCF6 WiFi'}</span>
                    ))}
                  </div>
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{log.timeIn}</td>
                <td style={{ color: '#6b7280' }}>{log.duration}h</td>
                <td>
                  <span className={`dtc-badge ${log.status === 'ACTIVE' ? 'dtc-badge-green' : log.status === 'OVERDUE' ? 'dtc-badge-red' : 'dtc-badge-gray'}`}>
                    {log.status === 'ACTIVE' && <span className="dtc-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
                    {log.status}
                  </span>
                </td>
                <td>{log.rating ? '\u2B50'.repeat(log.rating) : <span style={{ color: '#d1d5db', fontSize: 12 }}>&mdash;</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Purpose breakdown */}
      <div className="dtc-card" style={{ padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 16 }}>Top Purposes Today</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Online Job Application', pct: 28, color: '#0038A8' },
            { label: 'Government Transaction', pct: 22, color: '#6882FF' },
            { label: 'Digital Literacy / Learning', pct: 18, color: '#059669' },
            { label: 'SSS / GSIS / Pag-IBIG', pct: 15, color: '#d97706' },
            { label: 'Email and Communication', pct: 17, color: '#9ca3af' },
          ].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#374151', width: 200, flexShrink: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
              <div style={{ flex: 1, height: 8, background: '#f1f3f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, width: 32, textAlign: 'right' }}>{p.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Logbook Page ─────────────────────────────────────────────────────────────
function Logbook() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<typeof MOCK_LOGS[0] | null>(null)
  const filtered = MOCK_LOGS.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.fullName.toLowerCase().includes(q) || l.agency.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q)
    const matchFilter = filter === 'ALL' || l.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Logbook</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>All client entries &mdash; April 20, 2026</div>
        </div>
        <button className="dtc-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Icon name="export" size={14} color="#fff" /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="dtc-inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, agency, purpose\u2026" style={{ width: '100%', paddingLeft: 36 }} />
        </div>
        {['ALL', 'ACTIVE', 'COMPLETED', 'OVERDUE'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1.5px solid', borderColor: filter === f ? '#0038A8' : '#e5e7eb', background: filter === f ? '#0038A8' : '#fff', color: filter === f ? '#fff' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}>
            {f}
          </button>
        ))}
      </div>

      <div className="dtc-card" style={{ overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>#</th><th>Client</th><th>Agency</th><th>Purpose</th><th>Service</th><th>Time In</th><th>PC</th><th>Duration</th><th>Status</th><th>Rating</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(log === selected ? null : log)}>
                <td style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>#{String(log.id).padStart(4,'0')}</td>
                <td style={{ fontWeight: 600 }}>{log.fullName}</td>
                <td style={{ color: '#6b7280', fontSize: 12 }}>{log.agency}</td>
                <td style={{ color: '#6b7280', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.purpose}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {log.equipment.map(e => <span key={e} className={`dtc-badge ${e === 'Desktop Computer' ? 'dtc-badge-blue' : 'dtc-badge-green'}`} style={{ fontSize: 10 }}>{e === 'Desktop Computer' ? '\uD83D\uDDA5\uFE0F' : '\uD83D\uDCF6'}</span>)}
                  </div>
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{log.timeIn}</td>
                <td style={{ color: '#6b7280', fontSize: 12 }}>{log.pc || '\u2014'}</td>
                <td style={{ color: '#6b7280' }}>{log.duration}h</td>
                <td>
                  <span className={`dtc-badge ${log.status === 'ACTIVE' ? 'dtc-badge-green' : log.status === 'OVERDUE' ? 'dtc-badge-red' : 'dtc-badge-gray'}`} style={{ fontSize: 10 }}>
                    {log.status === 'ACTIVE' && <span className="dtc-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
                    {log.status}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{log.rating ? '\u2B50'.repeat(log.rating) : <span style={{ color: '#d1d5db' }}>&mdash;</span>}</td>
                <td><button style={{ color: '#9ca3af', padding: 4 }}><Icon name="eye" size={14} /></button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No entries found.</td></tr>
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
              ['Equipment', selected.equipment.join(', ')],
              ['Time In', selected.timeIn],
              ['Time Out', selected.timeOut || 'Still active'],
              ['Duration', `${selected.duration} hour(s)`],
              ['Workstation', selected.pc || 'WiFi only'],
            ] as [string, string][]).map(([k,v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Workstations Page ────────────────────────────────────────────────────────
function Workstations() {
  const [pcs, setPcs] = useState(MOCK_PCS)
  const statusColors: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
    ONLINE: { bg: '#d1fae5', border: '#6ee7b7', dot: '#059669', text: '#059669', label: 'Available' },
    IN_USE: { bg: '#ffedd5', border: '#fdba74', dot: '#ea580c', text: '#ea580c', label: 'In Use' },
    OFFLINE: { bg: '#f3f4f6', border: '#d1d5db', dot: '#6b7280', text: '#6b7280', label: 'Offline' },
    MAINTENANCE: { bg: '#fef9c3', border: '#fcd34d', dot: '#a16207', text: '#a16207', label: 'Maintenance' },
  }
  const cycle = (pcId: string) => {
    const next: Record<string, string> = { ONLINE: 'IN_USE', IN_USE: 'MAINTENANCE', MAINTENANCE: 'OFFLINE', OFFLINE: 'ONLINE' }
    setPcs(prev => prev.map(p => p.id === pcId ? { ...p, status: next[p.status] } : p))
  }

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Workstations</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Live PC status &mdash; click to cycle status (demo)</div>
        </div>
        <button className="dtc-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Icon name="plus" size={14} color="#fff" /> Add Workstation
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {Object.entries(statusColors).map(([s, c]) => (
          <div key={s} className="dtc-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1f36' }}>{pcs.filter(p => p.status === s).length}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dtc-card" style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 4 }}>Floor Layout</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Click any PC to cycle status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {pcs.map(pc => {
            const c = statusColors[pc.status] || statusColors.OFFLINE
            return (
              <div key={pc.id} onClick={() => cycle(pc.id)}
                style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: 12, padding: '14px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{'\uD83D\uDDA5\uFE0F'}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} className={pc.status === 'ONLINE' ? 'dtc-pulse' : ''} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>{pc.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{pc.location}</div>
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.7)', padding: '2px 7px', borderRadius: 20 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.text }}>{c.label}</span>
                </div>
                {pc.user && <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pc.user}</div>}
                <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#9ca3af' }}>{pc.ip}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dtc-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f3f9', fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>PC Registry</div>
        <table>
          <thead><tr><th>PC Name</th><th>Location</th><th>IP Address</th><th>Status</th><th>Current User</th><th>Actions</th></tr></thead>
          <tbody>
            {pcs.map(pc => {
              const c = statusColors[pc.status] || statusColors.OFFLINE
              return (
                <tr key={pc.id}>
                  <td style={{ fontWeight: 600 }}>{pc.name}</td>
                  <td style={{ color: '#6b7280' }}>{pc.location}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7280' }}>{pc.ip}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: c.bg, color: c.text, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />{c.label}</span></td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{pc.user || '\u2014'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="dtc-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>Edit</button>
                      <button className="dtc-btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Remove</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Announcements Page ───────────────────────────────────────────────────────
function Announcements() {
  const [anns, setAnns] = useState(INITIAL_ANNOUNCEMENTS)
  const [form, setForm] = useState({ title: '', body: '', type: 'INFO' })
  const typeColors: Record<string, string> = { INFO: 'dtc-badge-blue', WARNING: 'dtc-badge-yellow', MAINTENANCE: 'dtc-badge-orange', HOLIDAY: 'dtc-badge-red' }
  const typeIcons: Record<string, string> = { INFO: '\u2139\uFE0F', WARNING: '\u26A0\uFE0F', MAINTENANCE: '\uD83D\uDD27', HOLIDAY: '\uD83C\uDF89' }

  const add = () => {
    if (!form.title.trim()) return
    setAnns(prev => [{ id: Date.now(), ...form, active: true, created: 'Apr 20, 2026' }, ...prev])
    setForm({ title: '', body: '', type: 'INFO' })
  }

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Announcements</div>

      <div className="dtc-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>New Announcement</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="dtc-inp" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title\u2026" style={{ flex: 2 }} />
          <select className="dtc-inp" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ flex: 1 }}>
            {['INFO','WARNING','MAINTENANCE','HOLIDAY'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <textarea className="dtc-inp" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Optional body text\u2026" rows={2} style={{ resize: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="dtc-btn-primary" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Icon name="plus" size={14} color="#fff" /> Publish
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {anns.map(ann => (
          <div key={ann.id} className="dtc-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, opacity: ann.active ? 1 : 0.5 }}>
            <span style={{ fontSize: 22 }}>{typeIcons[ann.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>{ann.title}</span>
                <span className={`dtc-badge ${typeColors[ann.type]}`} style={{ fontSize: 10 }}>{ann.type}</span>
                {ann.active && <span className="dtc-badge dtc-badge-green" style={{ fontSize: 10 }}>LIVE</span>}
              </div>
              {ann.body && <div style={{ fontSize: 12, color: '#6b7280' }}>{ann.body}</div>}
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{ann.created}</div>
            </div>
            <label className="dtc-toggle">
              <input type="checkbox" checked={ann.active} onChange={() => setAnns(prev => prev.map(a => a.id === ann.id ? { ...a, active: !a.active } : a))} />
              <div className="dtc-toggle-track" />
              <div className="dtc-toggle-thumb" />
            </label>
            <button className="dtc-btn-danger" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setAnns(prev => prev.filter(a => a.id !== ann.id))}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const [settings, setSettings] = useState({ officeOpen: '08:00', officeClose: '17:00', wifiSsid: 'DICT-DTC-RegV', wifiPassword: 'dict2026!', wifiNote: 'Free public WiFi courtesy of DICT Region V', maxSession: 2, allowWalkIn: true, requirePhoto: false })
  const [saved, setSaved] = useState(false)
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const S = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f5f7fc' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Settings</div>

      <div className="dtc-card" style={{ padding: '4px 22px' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>Office Hours</div>
        <S label="Opening Time" sub="Clients can log in after this time">
          <input type="time" className="dtc-inp" value={settings.officeOpen} onChange={e => setSettings(s => ({ ...s, officeOpen: e.target.value }))} />
        </S>
        <S label="Closing Time" sub="Maximum session time is capped here">
          <input type="time" className="dtc-inp" value={settings.officeClose} onChange={e => setSettings(s => ({ ...s, officeClose: e.target.value }))} />
        </S>
        <S label="Max Session (hours)" sub="Default duration cap per client">
          <input type="number" min={0.5} max={8} step={0.5} className="dtc-inp" value={settings.maxSession} onChange={e => setSettings(s => ({ ...s, maxSession: parseFloat(e.target.value) }))} style={{ width: 80, textAlign: 'center' }} />
        </S>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>WiFi Configuration</div>
        <S label="Network SSID" sub="Broadcast name shown to clients">
          <input className="dtc-inp" value={settings.wifiSsid} onChange={e => setSettings(s => ({ ...s, wifiSsid: e.target.value }))} style={{ width: 220 }} />
        </S>
        <S label="Password" sub="Leave blank for open network">
          <input type="password" className="dtc-inp" value={settings.wifiPassword} onChange={e => setSettings(s => ({ ...s, wifiPassword: e.target.value }))} style={{ width: 220 }} />
        </S>
        <S label="WiFi Note" sub="Shown on the WiFi info screen">
          <input className="dtc-inp" value={settings.wifiNote} onChange={e => setSettings(s => ({ ...s, wifiNote: e.target.value }))} style={{ width: 280 }} />
        </S>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#0038A8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>Client Registration</div>
        <S label="Allow Walk-In Clients" sub="No appointment required">
          <label className="dtc-toggle">
            <input type="checkbox" checked={settings.allowWalkIn} onChange={e => setSettings(s => ({ ...s, allowWalkIn: e.target.checked }))} />
            <div className="dtc-toggle-track" /><div className="dtc-toggle-thumb" />
          </label>
        </S>
        <S label="Require Photo" sub="Mandatory photo capture on log-in">
          <label className="dtc-toggle">
            <input type="checkbox" checked={settings.requirePhoto} onChange={e => setSettings(s => ({ ...s, requirePhoto: e.target.checked }))} />
            <div className="dtc-toggle-track" /><div className="dtc-toggle-thumb" />
          </label>
        </S>
        <div style={{ padding: '16px 0' }}>
          <button className="dtc-btn-primary" onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {saved ? <><Icon name="check" size={14} color="#fff" /> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="dtc-card" style={{ padding: '4px 22px', border: '1.5px solid #fee2e2', background: '#fffafa' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 0 6px' }}>Danger Zone</div>
        <S label="Clear All Logs" sub="Permanently delete today's logbook entries">
          <button className="dtc-btn-danger">Clear Logs</button>
        </S>
        <S label="Reset System" sub="Restore all settings to defaults">
          <button className="dtc-btn-danger" style={{ marginBottom: 16 }}>Reset</button>
        </S>
      </div>
    </div>
  )
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
function Reports() {
  const total = MOCK_LOGS.length
  const ratings = MOCK_LOGS.filter(l => l.rating != null)
  const avgRating = ratings.reduce((a,b) => a + (b.rating ?? 0), 0) / ratings.length
  const dist = [5,4,3,2,1].map(r => ({ r, count: ratings.filter(l => l.rating === r).length }))

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>Reports &amp; Analytics</div>

      <div style={{ display: 'flex', gap: 14 }}>
        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Monthly Trend (2026)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 4 }}>
            {[{m:'Jan',v:182},{m:'Feb',v:241},{m:'Mar',v:198},{m:'Apr',v:156},{m:'May',v:0},{m:'Jun',v:0},{m:'Jul',v:0},{m:'Aug',v:0},{m:'Sep',v:0},{m:'Oct',v:0},{m:'Nov',v:0},{m:'Dec',v:0}].map(d => (
              <div key={d.m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, height:'100%' }}>
                <div style={{ flex:1, width:'100%', display:'flex', alignItems:'flex-end' }}>
                  <div style={{ width:'100%', background: d.v > 0 ? '#0038A8' : '#f1f3f9', borderRadius:'4px 4px 0 0', height: d.v > 0 ? `${(d.v/300)*100}%` : '8%', transition:'height 0.4s' }} />
                </div>
                <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600 }}>{d.m}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dtc-card" style={{ flex: 0.6, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 4 }}>Satisfaction Score</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Based on {ratings.length} ratings</div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{avgRating.toFixed(1)}</div>
            <div style={{ fontSize: 22, marginTop: 4 }}>{'\u2B50'.repeat(Math.round(avgRating))}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>out of 5.0</div>
          </div>
          {dist.map(({ r, count }) => (
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
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Service Breakdown</div>
          {[
            { label: 'Desktop Computer Only', count: MOCK_LOGS.filter(l => l.equipment.includes('Desktop Computer') && !l.equipment.includes('Internet Only')).length, color: '#0038A8' },
            { label: 'Internet/WiFi Only', count: MOCK_LOGS.filter(l => !l.equipment.includes('Desktop Computer') && l.equipment.includes('Internet Only')).length, color: '#6882FF' },
            { label: 'Both Services', count: MOCK_LOGS.filter(l => l.equipment.includes('Desktop Computer') && l.equipment.includes('Internet Only')).length, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.label}</div>
              <div style={{ flex: 2, height: 8, background: '#f1f3f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / total) * 100}%`, height: '100%', background: s.color, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color, width: 24 }}>{s.count}</div>
            </div>
          ))}
        </div>

        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', marginBottom: 16 }}>Today&apos;s Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total Clients', value: total, color: '#0038A8' },
              { label: 'Active Now', value: MOCK_LOGS.filter(l => l.status === 'ACTIVE').length, color: '#059669' },
              { label: 'Completed', value: MOCK_LOGS.filter(l => l.status === 'COMPLETED').length, color: '#6b7280' },
              { label: 'Overdue', value: MOCK_LOGS.filter(l => l.status === 'OVERDUE').length, color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f8faff', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button className="dtc-btn-primary" style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
            <Icon name="export" size={14} color="#fff" /> Export Full Report
          </button>
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
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="dtc-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1f36' }}>CV Station — Desktop App</div>

      <div style={{ display: 'flex', gap: 14 }}>
        {/* Download card */}
        <div className="dtc-card" style={{ flex: 1.2, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="camera" size={22} color="#4338ca" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36' }}>Face Recognition Attendance Client</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Packaged Windows desktop build — camera + check-in + offline queue</div>
            </div>
          </div>

          {loadingMeta ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Checking build status…</div>
          ) : meta?.available ? (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
                background: '#f8faff', padding: 14, borderRadius: 10,
              }}>
                <Kv k="Filename" v={meta.filename ?? '—'} />
                <Kv k="Version" v={meta.version ?? '—'} />
                <Kv k="Size" v={meta.sizeMB != null ? `${meta.sizeMB} MB` : '—'} />
                <Kv k="Built" v={meta.lastModified ? new Date(meta.lastModified).toLocaleString() : '—'} />
              </div>
              <button
                className="dtc-btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}
                onClick={handleDownload}
                disabled={downloading}
              >
                <Icon name="download" size={14} color="#fff" />
                {downloading ? 'Downloading…' : 'Download CV Station (.exe)'}
              </button>
            </>
          ) : (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
              padding: 14, fontSize: 12, color: '#92400e',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Build not available yet</div>
              <div>Run <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>cv-station/build.bat</code> on a Windows machine with Python 3.10+ to produce the .exe. The script copies it into the server's <code>downloads/</code> folder.</div>
              {meta?.hint && <div style={{ marginTop: 8, fontSize: 11, color: '#78350f' }}>{meta.hint}</div>}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, padding: 10, borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#991b1b', fontSize: 12,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={loadMeta}
              style={{
                fontSize: 12, padding: '8px 14px', borderRadius: 8,
                background: '#f1f3f9', color: '#374151', border: '1px solid #e5e7eb',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Refresh status
            </button>
          </div>
        </div>

        {/* Setup instructions */}
        <div className="dtc-card" style={{ flex: 1, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 12 }}>
            Setup on a new PC
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
            <li>Download <b>DICT-FaceCheckin.exe</b> using the button on the left.</li>
            <li>Copy the file to the target PC (USB stick, shared drive, etc.).</li>
            <li>Double-click. Windows may warn "unrecognized app" — choose <b>More info → Run anyway</b>.</li>
            <li>The <b>Setup Wizard</b> opens. Enter the <b>Server URL</b> and <b>API Key</b>, then click <b>Test Connection</b>.</li>
            <li>Four checks run: web app, API key, Convex, Google Sheets. All four must pass before <b>Save & Launch</b> enables.</li>
            <li>In the app, go to <b>⚙️ Settings</b> and toggle <b>Run on Windows startup</b> if desired.</li>
          </ol>
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            fontSize: 11, color: '#1e40af',
          }}>
            <b>Security:</b> The API key is stored at <code>%APPDATA%\DICT-FaceCheckin\config.json</code> encrypted via Windows DPAPI — tied to the Windows user account. Copying the config file to another PC won't leak the key.
          </div>
        </div>
      </div>

      {/* Verification flow */}
      <div className="dtc-card" style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 10 }}>
          How verification works
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
          Every setup call hits <code>POST /api/cv-station/verify</code>. The endpoint confirms all four sync dependencies before the .exe can be saved as configured.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { t: 'Web app', d: 'Reachable from the client' },
            { t: 'API key',  d: 'Matches server FACE_CV_API_KEY' },
            { t: 'Convex',   d: 'Interns table query returns' },
            { t: 'Sheets',   d: 'Service account can read each target sheet' },
          ].map((c) => (
            <div key={c.t} style={{ background: '#f8faff', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36' }}>{c.t}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{c.d}</div>
            </div>
          ))}
        </div>
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
  { id: 'announcements', label: 'Announcements', icon: 'announce', section: null, badge: 2 },
  { id: 'reports', label: 'Reports', icon: 'reports', section: 'Analytics' },
  { id: 'cvstation', label: 'CV Station', icon: 'camera', section: 'Devices' },
  { id: 'settings', label: 'Settings', icon: 'settings', section: null },
]

const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  logbook: Logbook,
  workstations: Workstations,
  announcements: Announcements,
  settings: SettingsPage,
  reports: Reports,
  cvstation: CVStation,
}

export default function DTCAdminPage() {
  const [page, setPage] = useState('dashboard')
  const [now, setNow] = useState(new Date())
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS)
  const [showTweaks, setShowTweaks] = useState(false)

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

  const PageComp = PAGES[page] ?? Dashboard
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
              const prevSection = i > 0 ? NAV_ITEMS[i-1].section : null
              return (
                <Fragment key={item.id}>
                  {item.section && item.section !== prevSection && (
                    <div className="dtc-nav-section-label">{item.section}</div>
                  )}
                  <div className={`dtc-nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}
                    style={page === item.id ? { background: `${tweaks.accentColor}30` } : {}}>
                    <span className="dtc-nav-icon"><Icon name={item.icon} size={15} color={page === item.id ? '#fff' : 'rgba(255,255,255,0.5)'} /></span>
                    <span>{item.label}</span>
                    {item.badge && <span style={{ background: '#CE1126', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginLeft: 'auto' }}>{item.badge}</span>}
                    {!item.badge && <div className="dtc-nav-dot" />}
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
            <PageComp />
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
