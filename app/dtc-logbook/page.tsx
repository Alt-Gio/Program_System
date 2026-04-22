'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { format, addHours, setHours, setMinutes, setSeconds } from 'date-fns'
import {
  countQueued,
  drainQueue,
  enqueue,
  generateClientId,
  requestSwDrain,
} from '@/lib/offline-queue'
import { loadSnapshot, saveSnapshot } from '@/lib/dtc-logbook-cache'

const LOGBOOK_ENDPOINT = '/api/dtc-logbook/log'
const LOGBOOK_STORE = 'dtcLogbookQueue' as const

// ─── Constants ────────────────────────────────────────────────────────────────
const PURPOSE_SUGGESTIONS = [
  'Online Job Application',
  'Government Transaction (e-Gov)',
  'PhilSys / National ID Registration',
  'SSS / GSIS / Pag-IBIG Online Transaction',
  'PhilHealth Online Transaction',
  'Online Scholarship Application',
  'School / University Enrollment',
  'Research and Information Gathering',
  'Resume / CV Preparation',
  'Email and Communication',
  'Online Business Transaction',
  'Freelance Work',
  'Digital Literacy / Learning',
  'Video / Online Meeting',
  'Printing / Document Processing',
  'Other Government Services',
]

const PC_TERMS = [
  'I will treat the computer equipment with utmost care and report any damage immediately.',
  'I will not install unauthorized software or make changes to system settings.',
  'I will not access illegal, inappropriate, or malicious websites or content.',
  'I will log out of all accounts before leaving the workstation.',
  'I understand that session time is limited and I will vacate the workstation on time.',
]

const WIFI_TERMS = [
  'I will use the free WiFi connection responsibly and for lawful purposes only.',
  'I will not use the connection for downloading illegal content or torrenting.',
  'I will not attempt to access unauthorized networks or systems.',
  'I understand that internet usage may be monitored for security purposes.',
  'I will not share or redistribute the WiFi credentials to unauthorized persons.',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'form' | 'pc-select' | 'internet-info' | 'success'

type SubmittedLog = {
  id: Id<'dtcLogs'>
  timeIn: string
  fullName: string
  plannedDurationHours: number
  pc?: { name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

function getOfficeState(now: Date, open: string, close: string): 'closed' | 'open' | 'closing_soon' {
  const o = parseTime(open), c = parseTime(close)
  const total = now.getHours() * 60 + now.getMinutes()
  const openM = o.h * 60 + o.m, closeM = c.h * 60 + c.m
  if (total < openM || total >= closeM) return 'closed'
  if (closeM - total <= 30) return 'closing_soon'
  return 'open'
}

function getMaxDurationHours(now: Date, close: string): number {
  const c = parseTime(close)
  const closeDate = setSeconds(setMinutes(setHours(new Date(now), c.h), c.m), 0)
  const diffMs = closeDate.getTime() - now.getTime()
  return Math.max(0.25, Math.floor((diffMs / 3600000) * 4) / 4)
}

function closingAt(close: string): string {
  const c = parseTime(close)
  const d = new Date()
  d.setHours(c.h, c.m, 0, 0)
  return format(d, 'h:mm a')
}

function sanitizeName(val: string): string {
  return val.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s.\-']/g, '')
}

function sanitizeAgency(val: string): string {
  return val.replace(/[^a-zA-Z0-9\s.\-&,'()\/]/g, '')
}

function wifiQrUrl(ssid: string, password: string): string {
  const data = password ? `WIFI:T:WPA;S:${ssid};P:${password};;` : `WIFI:T:nopass;S:${ssid};;;`
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`
}

// ─── Small UI helpers ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function iCls(err: boolean) {
  return `w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${
    err ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100'
        : 'border-gray-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50'
  }`
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠</span>{error}</p>}
    </div>
  )
}

function SRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-semibold text-sm ${highlight ? 'text-[#0038A8]' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

// ─── Terms Checkbox Block ──────────────────────────────────────────────────────
function TermsBlock({ title, icon, color, terms, checked, onChange }: {
  title: string; icon: string; color: string
  terms: string[]; checked: boolean[]; onChange: (i: number, v: boolean) => void
}) {
  const allChecked = checked.every(Boolean)
  return (
    <div className={`rounded-2xl border-2 ${allChecked ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'} p-4 space-y-3 transition-all`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        {allChecked && <span className="ml-auto text-xs text-green-600 font-semibold bg-green-100 px-2 py-0.5 rounded-full">✓ Agreed</span>}
      </div>
      {terms.map((term, i) => (
        <label key={i} className="flex items-start gap-3 cursor-pointer group">
          <div
            onClick={() => onChange(i, !checked[i])}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              checked[i] ? 'bg-[#0038A8] border-[#0038A8]' : 'border-gray-300 group-hover:border-blue-300'
            }`}
          >
            {checked[i] && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-xs text-gray-600 leading-relaxed">{term}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Duration Picker ───────────────────────────────────────────────────────────
function DurationPicker({ now, maxDuration, officeCloseStr, usageDuration, setUsageDuration, customDuration, setCustomDuration, showCustom, setShowCustom }: {
  now: Date; maxDuration: number; officeCloseStr: string
  usageDuration: string; setUsageDuration: (v: string) => void
  customDuration: string; setCustomDuration: (v: string) => void
  showCustom: boolean; setShowCustom: (v: boolean) => void
}) {
  const presets = [
    { label: '30 min', value: '0.5' }, { label: '1 hr', value: '1' },
    { label: '2 hrs', value: '2' }, { label: '3 hrs', value: '3' },
    { label: 'Other', value: 'custom' },
  ].filter(p => p.value === 'custom' || parseFloat(p.value) <= maxDuration)

  const getMaxTime = () => {
    const d = new Date(now)
    d.setHours(d.getHours() + Math.floor(maxDuration))
    d.setMinutes((maxDuration % 1) * 60)
    return format(d, 'HH:mm')
  }

  const handleEndTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number)
    const end = setSeconds(setMinutes(setHours(new Date(now), h), m), 0)
    const diff = (end.getTime() - now.getTime()) / 3600000
    if (diff > 0 && diff <= maxDuration) setCustomDuration(String(Math.round(diff * 4) / 4))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {presets.map(p => (
          <button key={p.value} type="button"
            onClick={() => {
              if (p.value === 'custom') { setShowCustom(true); setUsageDuration('custom') }
              else { setShowCustom(false); setUsageDuration(p.value) }
            }}
            className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              (p.value === 'custom' ? showCustom : usageDuration === p.value && !showCustom)
                ? 'bg-[#0038A8] text-white border-[#0038A8]'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <label className="text-xs font-semibold text-gray-500 block">I plan to leave at:</label>
          <input type="time" min={format(now, 'HH:mm')} max={getMaxTime()} onChange={handleEndTime}
            className="w-full border border-blue-200 bg-white rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#0038A8]" />
          {customDuration && (
            <p className="text-xs text-blue-600">
              ≈ {parseFloat(customDuration).toFixed(2).replace(/\.00$/, '')} hours
              {parseFloat(customDuration) >= maxDuration && (
                <span className="text-amber-600 ml-2">⚠ Capped at {officeCloseStr}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Data Privacy Modal ────────────────────────────────────────────────────────
function DataPrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,20,80,0.65)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="bg-[#0038A8] text-white rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg">Data Privacy Act of 2012</h3>
            <p className="text-blue-200 text-xs">Republic Act No. 10173</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">✕</button>
        </div>
        <div className="overflow-y-auto p-6 text-sm text-gray-600 space-y-4 flex-1">
          <p className="font-semibold text-gray-800">Your Rights Under RA 10173</p>
          <p>The Department of Information and Communications Technology (DICT) Region V is committed to protecting your personal information in accordance with the Data Privacy Act of 2012.</p>
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-[#0038A8]">Information We Collect:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Full name and agency/organization</li>
              <li>Purpose of visit and services availed</li>
              <li>Time in and time out records</li>
              <li>Optional facial photo for identification</li>
              <li>ICT equipment or internet service used</li>
            </ul>
          </div>
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-green-700">How We Use Your Data:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Monitoring and reporting on DTC service delivery</li>
              <li>Security and safety of equipment and premises</li>
              <li>Statistical reporting to DICT central office</li>
              <li>Improvement of government digital services</li>
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-amber-700">Your Rights:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li><strong>Right to be informed</strong> — you know what data we collect</li>
              <li><strong>Right to access</strong> — you may request a copy of your data</li>
              <li><strong>Right to object</strong> — you may decline non-essential data collection</li>
              <li><strong>Right to erasure</strong> — you may request deletion of your data</li>
              <li><strong>Right to rectification</strong> — you may correct inaccurate data</li>
            </ul>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-700 mb-1">Data Retention:</p>
            <p className="text-xs">Logbook records are retained for a maximum of one (1) year from the date of collection, after which they are securely disposed of in accordance with DICT records management policies.</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-semibold text-gray-700 mb-1">Contact Our Data Protection Officer:</p>
            <p className="text-xs text-gray-500">DICT Region V — Digital Transformation Center</p>
            <p className="text-xs text-gray-500">Legazpi City, Albay 4500</p>
            <p className="text-xs text-gray-500">region5@dict.gov.ph</p>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 bg-[#0038A8] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors">
            I Understand — Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── House Rules Modal ─────────────────────────────────────────────────────────
function HouseRulesModal({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,20,80,0.65)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0038A8] text-white rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg">House Rules &amp; Guidelines</h3>
            <p className="text-blue-200 text-xs">DICT Digital Transformation Center — Region V</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4 text-sm text-gray-600">
          <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
            By using this facility you agree to comply with the following rules.
          </p>
          <div className="rounded-xl border border-blue-100 overflow-hidden">
            <div className="bg-blue-50 px-4 py-2.5 font-bold text-blue-700 text-xs uppercase tracking-wide flex items-center gap-2">🖥️ Section 1 — Computer Laboratory</div>
            <ul className="p-4 space-y-2">
              {['Maintain cleanliness at all times. No food or drinks inside the laboratory.',
                'Treat all equipment with care. Report damage or defects to staff immediately.',
                'Do not install unauthorized software or modify any hardware or system settings.',
                'Do not access inappropriate, illegal, or malicious websites or content.',
                'Log out of all accounts and properly shut down the computer before leaving.',
                'Sessions are limited to 2 hours during peak hours. Vacate on time.'].map((r, i) => (
                <li key={i} className="flex gap-2 text-xs leading-snug">
                  <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-indigo-100 overflow-hidden">
            <div className="bg-indigo-50 px-4 py-2.5 font-bold text-indigo-700 text-xs uppercase tracking-wide flex items-center gap-2">🏛️ Section 2 — DTC Hall &amp; Premises</div>
            <ul className="p-4 space-y-2">
              {['Keep noise to a minimum. No shouting or disruptive behavior.',
                'Dispose of trash properly. Eat only in designated areas outside.',
                'Respect all furniture and fixtures. Vandalism is strictly prohibited.',
                'Follow instructions from staff and facilitators at all times.'].map((r, i) => (
                <li key={i} className="flex gap-2 text-xs leading-snug">
                  <span className="text-indigo-400 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-100 overflow-hidden">
            <div className="bg-red-50 px-4 py-2.5 font-bold text-red-700 text-xs uppercase tracking-wide flex items-center gap-2">⚖️ Violations &amp; Sanctions</div>
            <div className="p-4 space-y-2">
              {[
                { level: 'Minor', action: 'Verbal warning', color: 'bg-yellow-50 text-yellow-800' },
                { level: 'Moderate', action: 'Session termination', color: 'bg-orange-50 text-orange-800' },
                { level: 'Major', action: 'Removal from premises', color: 'bg-red-50 text-red-800' },
                { level: 'Severe', action: 'Ban + legal action', color: 'bg-rose-50 text-rose-900' },
              ].map((v, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 ${v.color} flex items-center gap-3`}>
                  <span className="font-bold text-xs w-16 flex-shrink-0">{v.level}</span>
                  <span className="text-xs font-bold ml-auto">→ {v.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50">Close</button>
          <button onClick={onAgree} className="flex-[2] py-3 bg-[#0038A8] text-white rounded-xl text-sm font-bold hover:bg-blue-800">✓ I Have Read and Agree</button>
        </div>
      </div>
    </div>
  )
}

// ─── PC Floor Grid ─────────────────────────────────────────────────────────────
function PcFloorGrid({ pcs, selectedId, onSelect, now }: {
  pcs: {
    id: string; name: string; location: string | null; status: string
    icon?: string | null; gridCol?: number | null; gridRow?: number | null
    logs?: { id: string; fullName: string; timeIn: string; photoDataUrl?: string | null; plannedDurationHours?: number }[]
    ipAddress: string
  }[]
  selectedId: string; onSelect: (id: string) => void; now: Date
}) {
  const maxCol = Math.max(5, ...pcs.map(p => p.gridCol ?? 1))
  const maxRow = Math.max(1, ...pcs.map(p => p.gridRow ?? 1))

  return (
    <div>
      <div className="flex gap-3 flex-wrap mb-3 text-xs">
        {[
          { color: 'bg-green-400', label: 'Available' },
          { color: 'bg-orange-400', label: 'In Use' },
          { color: 'bg-gray-300', label: 'Offline' },
          { color: 'bg-yellow-400', label: 'Maintenance' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${l.color}`} />
            <span className="text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
      <div
        className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50 p-2"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))`, gap: '6px' }}
      >
        {Array.from({ length: maxRow }, (_, row) =>
          Array.from({ length: maxCol }, (_, col) => {
            const r = row + 1, c = col + 1
            const pc = pcs.find(p => (p.gridRow ?? 1) === r && (p.gridCol ?? 1) === c)

            if (!pc) {
              return <div key={`${r}-${c}`} className="rounded-xl border border-dashed border-gray-200 min-h-[90px] bg-white/50" />
            }

            const isSelectable = pc.status !== 'IN_USE' && pc.status !== 'MAINTENANCE'
            const isSel = selectedId === pc.id
            const currentUser = pc.logs?.[0]
            const initials = currentUser
              ? currentUser.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              : ''

            let userStatus: 'ok' | 'soon' | 'overdue' | null = null
            if (currentUser && pc.status === 'IN_USE') {
              const dur = currentUser.plannedDurationHours ?? 1
              const expectedOut = new Date(new Date(currentUser.timeIn).getTime() + dur * 3600000)
              const minsLeft = Math.floor((expectedOut.getTime() - now.getTime()) / 60000)
              userStatus = minsLeft < 0 ? 'overdue' : minsLeft <= 15 ? 'soon' : 'ok'
            }

            return (
              <div key={`${r}-${c}`}
                onClick={() => isSelectable && onSelect(isSel ? '' : pc.id)}
                className={`rounded-xl border-2 p-2.5 transition-all select-none ${
                  isSel ? 'border-[#0038A8] bg-blue-50 ring-2 ring-blue-200 cursor-pointer'
                  : pc.status === 'IN_USE' ? 'border-orange-300 bg-orange-50 cursor-not-allowed'
                  : pc.status === 'MAINTENANCE' ? 'border-yellow-300 bg-yellow-50 opacity-50 cursor-not-allowed'
                  : pc.status === 'ONLINE' ? 'border-green-300 bg-green-50 hover:border-green-500 hover:scale-[1.02] cursor-pointer'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:scale-[1.02] cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg leading-none">{pc.icon || '🖥️'}</span>
                  <div className="flex items-center gap-1">
                    {isSel && <span className="text-[10px] bg-[#0038A8] text-white px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      pc.status === 'ONLINE' ? 'bg-green-500 animate-pulse'
                      : pc.status === 'IN_USE' ? (userStatus === 'overdue' ? 'bg-red-500' : 'bg-orange-500')
                      : pc.status === 'MAINTENANCE' ? 'bg-yellow-400'
                      : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
                <p className="font-bold text-gray-800 text-xs leading-tight">{pc.name}</p>
                {pc.location && <p className="text-gray-400 text-[10px] truncate">{pc.location}</p>}
                <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  pc.status === 'ONLINE' ? 'bg-green-100 text-green-700'
                  : pc.status === 'IN_USE' ? (userStatus === 'overdue' ? 'bg-red-100 text-red-600' : userStatus === 'soon' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-700')
                  : pc.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {pc.status === 'IN_USE' ? (userStatus === 'overdue' ? '⚠ Overdue' : userStatus === 'soon' ? '⏰ Almost done' : 'In Use')
                    : pc.status === 'ONLINE' ? 'Available'
                    : pc.status === 'MAINTENANCE' ? 'Maintenance'
                    : 'Offline'}
                </span>
                {pc.status === 'IN_USE' && currentUser && (
                  <div className="mt-2 pt-1.5 border-t border-orange-200 flex items-center gap-1.5">
                    {currentUser.photoDataUrl
                      ? <img src={currentUser.photoDataUrl} className="w-7 h-7 rounded-full object-cover border border-orange-200 flex-shrink-0" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-[10px] flex-shrink-0">{initials}</div>
                    }
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-orange-800 truncate">{currentUser.fullName.split(' ')[0]}</p>
                      {(() => {
                        const dur = currentUser.plannedDurationHours ?? 1
                        const expectedOut = new Date(new Date(currentUser.timeIn).getTime() + dur * 3600000)
                        const minsLeft = Math.floor((expectedOut.getTime() - now.getTime()) / 60000)
                        if (minsLeft < 0) return <p className="text-[9px] text-red-500 font-semibold">⚠ {Math.abs(minsLeft)}m overdue</p>
                        return <p className="text-[9px] text-orange-400">out ~{format(expectedOut, 'hh:mm a')}</p>
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ log, photo, officeCloseStr, onReset, onRate, queued = false }: {
  log: SubmittedLog; photo: string | null; officeCloseStr: string
  onReset: () => void; onRate: (rating: number) => Promise<void>
  queued?: boolean
}) {
  const [countdown, setCountdown] = useState(12)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [paused, setPaused] = useState(false)

  const dur = log.plannedDurationHours || 1
  const expectedOut = new Date(new Date(log.timeIn).getTime() + dur * 3600000)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onReset(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onReset, paused])

  const submitRating = async (r: number) => {
    setRating(r); setPaused(true)
    await onRate(r)
    setRatingSubmitted(true)
    setTimeout(onReset, 2500)
  }

  const pct = (countdown / 12) * 100
  const starLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border border-gray-100">
        <div className="relative inline-block mb-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${queued ? 'bg-amber-100' : 'bg-green-100'}`}>
            {photo
              ? <img src={photo} className={`w-20 h-20 rounded-full object-cover border-4 ${queued ? 'border-amber-300' : 'border-green-300'}`} alt="" />
              : queued
                ? <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                : <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
            }
          </div>
          {photo && (
            <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white ${queued ? 'bg-amber-500' : 'bg-green-500'}`}>
              {queued
                ? <span className="text-white text-xs font-bold">⏱</span>
                : <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
              }
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-[#0038A8] mb-1">
          {queued ? 'Saved Offline' : 'You\u2019re Logged In!'}
        </h2>
        <p className="text-gray-400 text-sm mb-5">
          {queued
            ? `Your entry is stored on this device, ${log.fullName}. It will sync automatically when the connection is back.`
            : `Welcome, ${log.fullName}!`}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 mb-4">
          <SRow label="Time In" value={format(new Date(log.timeIn), 'hh:mm:ss a')} />
          {log.pc && <SRow label="Workstation" value={log.pc.name} />}
          <SRow label="Expected Out By" value={format(expectedOut, 'hh:mm a')} highlight />
          <SRow label="Duration" value={`${dur} hr${dur !== 1 ? 's' : ''}`} />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 mb-5">
          ⏰ Please finish and step out by <strong>{officeCloseStr}</strong>
        </div>

        {queued ? (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800">
            You can close this tab — your entry will still be submitted once the device reconnects. Rating will be available next time.
          </div>
        ) : !ratingSubmitted ? (
          <div className="mb-5 bg-blue-50 rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">How would you rate our service today?</p>
            <div className="flex justify-center gap-2 mb-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => submitRating(s)}
                  className="text-3xl transition-transform hover:scale-125 focus:outline-none"
                >
                  {s <= (hoverRating || rating) ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {(hoverRating || rating) > 0 && (
              <p className="text-xs text-[#0038A8] font-semibold mt-1">{starLabels[(hoverRating || rating) - 1]}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-2">Tap a star to submit · Your feedback is anonymous</p>
          </div>
        ) : (
          <div className="mb-5 bg-green-50 rounded-2xl px-4 py-4 flex items-center justify-center gap-3">
            <span className="text-2xl">🙏</span>
            <div className="text-left">
              <p className="text-sm font-bold text-green-700">Thank you for your feedback!</p>
              <p className="text-xs text-green-500">Rating: {rating}/5 stars</p>
            </div>
          </div>
        )}

        {!paused && (
          <div className="mb-4">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-1.5 bg-[#0038A8] rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Returning in <strong className="text-[#0038A8]">{countdown}s</strong></p>
          </div>
        )}

        <button onClick={onReset} className="w-full py-3 rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 transition-colors">
          New Entry
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DTCLogbookPage() {
  const [now, setNow] = useState(new Date())
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedLog, setSubmittedLog] = useState<SubmittedLog | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form state
  const [form, setForm] = useState({
    fullName: '', agency: '', purpose: '',
    equipmentUsed: [] as string[], pcId: '',
    contactEmail: '', contactPhone: '',
  })
  const [usageDuration, setUsageDuration] = useState('1')
  const [customDuration, setCustomDuration] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [rulesAgreed, setRulesAgreed] = useState(false)
  const [pcTerms, setPcTerms] = useState(PC_TERMS.map(() => false))
  const [wifiTerms, setWifiTerms] = useState(WIFI_TERMS.map(() => false))
  const [purposeFocus, setPurposeFocus] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Offline-aware state
  const [isOnline, setIsOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [draining, setDraining] = useState(false)
  const [submittedQueued, setSubmittedQueued] = useState(false)

  // Last-known snapshots for offline hydration
  const [settingsSnap, setSettingsSnap] = useState<any>(null)
  const [pcsSnap, setPcsSnap] = useState<any>(null)
  const [announcementsSnap, setAnnouncementsSnap] = useState<any>(null)

  // Convex data (live when online, null while offline/loading)
  const liveSettings = useQuery(api.dtcSettings.getAll)
  const livePcs = useQuery(api.dtcPcs.getAll)
  const liveAnnouncements = useQuery(api.dtcAnnouncements.getActive)
  // Submission is posted to /api/dtc-logbook/log so the service worker can
  // intercept and queue offline writes. Rating updates still go through
  // Convex directly because they only run when online.
  const updateLog = useMutation(api.dtcLogs.update)

  // Merge live data with cached snapshots so the form still works offline.
  // Cast to preserve the Convex query's return type through the fallback.
  const settings = (liveSettings ?? settingsSnap) as typeof liveSettings
  const pcs = (livePcs ?? pcsSnap) as typeof livePcs
  const announcements = (liveAnnouncements ?? announcementsSnap) as typeof liveAnnouncements

  // Persist fresh reads to localStorage whenever Convex returns new data.
  useEffect(() => {
    if (liveSettings) saveSnapshot('settings', liveSettings)
  }, [liveSettings])
  useEffect(() => {
    if (livePcs) saveSnapshot('pcs', livePcs)
  }, [livePcs])
  useEffect(() => {
    if (liveAnnouncements) saveSnapshot('announcements', liveAnnouncements)
  }, [liveAnnouncements])

  // Hydrate from snapshots on first mount + set up online/offline listeners.
  useEffect(() => {
    setSettingsSnap(loadSnapshot('settings'))
    setPcsSnap(loadSnapshot('pcs'))
    setAnnouncementsSnap(loadSnapshot('announcements'))

    let cancelled = false
    const refreshQueue = async () => {
      const n = await countQueued(LOGBOOK_STORE)
      if (!cancelled) setQueuedCount(n)
    }
    const drain = async () => {
      if (!navigator.onLine) return
      setDraining(true)
      try {
        requestSwDrain()
        await drainQueue(LOGBOOK_STORE, LOGBOOK_ENDPOINT)
      } finally {
        if (!cancelled) setDraining(false)
        await refreshQueue()
      }
    }
    const onOnline = () => { setIsOnline(true); drain() }
    const onOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)
    refreshQueue()
    if (navigator.onLine) drain()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const onSwMessage = (evt: MessageEvent) => {
      if (evt.data?.type === 'dtc-sync-result') refreshQueue()
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage)
      }
    }
  }, [])

  const manualRetry = useCallback(async () => {
    setDraining(true)
    try {
      requestSwDrain()
      await drainQueue(LOGBOOK_STORE, LOGBOOK_ENDPOINT)
    } finally {
      setDraining(false)
      setQueuedCount(await countQueued(LOGBOOK_STORE))
    }
  }, [])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Camera cleanup
  useEffect(() => () => stopCamera(), [])

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      videoRef.current = node
      if (streamRef.current) { node.srcObject = streamRef.current; node.play().catch(() => {}) }
    }
  }, [])

  const startCamera = async () => {
    setCameraError(null); stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
      })
      streamRef.current = stream; setCameraActive(true)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      }, 80)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setCameraError(
        msg.includes('Permission') || msg.includes('NotAllowed') ? 'Camera permission denied. Allow in browser settings.'
        : msg.includes('NotFound') ? 'No camera found.'
        : 'Camera error: ' + msg
      )
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  const capturePhoto = () => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c) return
    c.width = v.videoWidth || 320; c.height = v.videoHeight || 240
    c.getContext('2d')?.drawImage(v, 0, 0)
    setPhoto(c.toDataURL('image/jpeg', 0.75))
    stopCamera()
  }

  // Derived state
  const hasPC = form.equipmentUsed.includes('Desktop Computer')
  const hasWifi = form.equipmentUsed.includes('Internet Only')
  const hasBoth = hasPC && hasWifi
  const pcTermsOk = !hasPC || pcTerms.every(Boolean)
  const wifiTermsOk = !hasWifi || wifiTerms.every(Boolean)

  const officeOpen = settings?.officeOpen ?? '08:00'
  const officeClose = settings?.officeClose ?? '17:00'
  const officeState = getOfficeState(now, officeOpen, officeClose)
  const officeCloseStr = closingAt(officeClose)
  const maxDuration = getMaxDurationHours(now, officeClose)
  const effectiveDuration = showCustom
    ? Math.min(parseFloat(customDuration) || 1, maxDuration)
    : Math.min(parseFloat(usageDuration) || 1, maxDuration)

  const purposeSuggestions = useMemo(() => {
    if (!form.purpose || form.purpose.length < 2) return PURPOSE_SUGGESTIONS
    return PURPOSE_SUGGESTIONS.filter(s => s.toLowerCase().includes(form.purpose.toLowerCase()))
  }, [form.purpose])

  const toggleEquipment = (item: string) => {
    const isAdding = !form.equipmentUsed.includes(item)
    setForm(f => ({
      ...f,
      equipmentUsed: f.equipmentUsed.includes(item)
        ? f.equipmentUsed.filter(e => e !== item)
        : [...f.equipmentUsed, item]
    }))
    if (item === 'Desktop Computer') {
      setPcTerms(PC_TERMS.map(() => false))
    }
    if (item === 'Internet Only') {
      setWifiTerms(WIFI_TERMS.map(() => false))
    }
  }

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    else if (form.fullName.trim().split(/\s+/).length < 2) e.fullName = 'Please enter your complete first and last name'
    if (!form.agency.trim()) e.agency = 'Agency / organization is required'
    if (!form.purpose.trim() || form.purpose.trim().length < 5) e.purpose = 'Describe your purpose (minimum 5 characters)'
    if (form.equipmentUsed.length === 0) e.equipment = 'Please select at least one service'
    if (hasPC) {
      if (!form.contactEmail.trim() && !form.contactPhone.trim()) e.contact = 'Email or phone is required for PC use'
      else if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) e.contact = 'Please enter a valid email address'
    }
    if (!rulesAgreed) e.rules = 'Please read and agree to the DTC House Rules to continue'
    if (!pcTermsOk) e.terms = 'Please agree to all computer use terms'
    if (!wifiTermsOk) e.terms = 'Please agree to all WiFi use terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (!validateForm()) return
    if (hasPC) setStep('pc-select')
    else if (hasWifi) setStep('internet-info')
  }

  const handlePcNext = () => {
    if (hasBoth) setStep('internet-info')
    else handleSubmit()
  }

  const handleSubmit = async (selectedPcId?: string) => {
    setSubmitting(true)
    setSubmitError(null)
    setSubmittedQueued(false)

    const finalPcId = (selectedPcId || form.pcId || '') as string
    const clientTimeIn = new Date().toISOString()
    const clientId = generateClientId()

    const payload = {
      clientId,
      fullName: form.fullName.trim(),
      agency: form.agency.trim(),
      purpose: form.purpose.trim(),
      equipmentUsed: form.equipmentUsed,
      pcId: finalPcId || undefined,
      photoDataUrl: photo || undefined,
      plannedDurationHours: effectiveDuration,
      serviceType: 'SELF_SERVICE',
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      submittedOffline: typeof navigator !== 'undefined' && !navigator.onLine,
      clientTimeIn,
    }

    const selectedPc = pcs?.find((p: any) => p._id === finalPcId)

    // Helper: finalize the UI for either synced or queued outcomes.
    const showSuccess = (opts: {
      queued: boolean
      logId?: string
      timeIn: string
    }) => {
      setSubmittedLog({
        id: (opts.logId ?? `local:${clientId}`) as Id<'dtcLogs'>,
        timeIn: opts.timeIn,
        fullName: form.fullName.trim(),
        plannedDurationHours: effectiveDuration,
        pc: selectedPc ? { name: selectedPc.name } : null,
      })
      setSubmittedQueued(opts.queued)
      stopCamera()
      setStep('success')
    }

    try {
      const res = await fetch(LOGBOOK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let data: any = null
      try { data = await res.json() } catch {}

      if (res.status === 202 && data?.queued) {
        setQueuedCount(await countQueued(LOGBOOK_STORE))
        showSuccess({ queued: true, timeIn: clientTimeIn })
      } else if (res.ok && data?.ok) {
        showSuccess({ queued: false, logId: data.id, timeIn: data.timeIn })
      } else {
        throw new Error(data?.error || `Server responded ${res.status}`)
      }
    } catch (networkErr) {
      // Network dead (or SW didn't intercept). Queue locally and show success.
      try {
        await enqueue(LOGBOOK_STORE, payload)
        setQueuedCount(await countQueued(LOGBOOK_STORE))
        showSuccess({ queued: true, timeIn: clientTimeIn })
      } catch (idbErr: unknown) {
        setSubmitError(
          idbErr instanceof Error
            ? idbErr.message
            : 'Submission failed. Please try again.'
        )
        setStep('form')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRate = async (rating: number) => {
    if (!submittedLog) return
    await updateLog({ id: submittedLog.id, satisfactionRating: rating }).catch(() => {})
  }

  const resetForm = () => {
    setForm({ fullName: '', agency: '', purpose: '', equipmentUsed: [], pcId: '', contactEmail: '', contactPhone: '' })
    setErrors({}); setSubmitError(null); setSubmittedLog(null); setPhoto(null)
    setUsageDuration('1'); setCustomDuration(''); setShowCustom(false)
    setPcTerms(PC_TERMS.map(() => false)); setWifiTerms(WIFI_TERMS.map(() => false))
    setConsentChecked(false); setRulesAgreed(false)
    stopCamera(); setStep('form')
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#0038A8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading DTC Logbook…</p>
        </div>
      </div>
    )
  }

  // ── Office Closed ─────────────────────────────────────────────────────────────
  if (officeState === 'closed') {
    const openTime = closingAt(officeOpen)
    const isBeforeOpen = now.getHours() < parseTime(officeOpen).h
    return (
      <div className="min-h-screen bg-[#0038A8] flex flex-col items-center justify-center p-4 text-white text-center">
        <div className="text-6xl mb-6 animate-bounce">{isBeforeOpen ? '🌅' : '🌙'}</div>
        <h1 className="text-3xl font-bold mb-2">Office Closed</h1>
        <p className="text-blue-200 mb-1">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        <p className="font-mono text-4xl font-bold mb-6">{format(now, 'hh:mm:ss a')}</p>
        <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-5 mb-4">
          <p className="text-blue-200 text-sm mb-1">Office Hours</p>
          <p className="font-bold text-xl">{openTime} – {officeCloseStr}</p>
          <p className="text-blue-200 text-sm mt-1">Monday – Friday</p>
        </div>
        {settings.wifiSsid && (
          <div className="mt-4 bg-white/10 rounded-2xl px-6 py-4 max-w-xs w-full">
            <p className="text-blue-200 text-sm mb-2">📶 WiFi Access</p>
            <p className="font-mono font-bold">{settings.wifiSsid}</p>
            {settings.wifiPassword && <p className="text-blue-200 text-sm mt-1">{settings.wifiPassword}</p>}
          </div>
        )}
        <div className="absolute bottom-6 text-center">
          <p className="text-blue-300 text-xs">📍 DICT Region V · Legazpi City, Albay · (052) 742-5670</p>
        </div>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────────
  if (step === 'success' && submittedLog) {
    return (
      <>
        {showPrivacyModal && <DataPrivacyModal onClose={() => setShowPrivacyModal(false)} />}
        <SuccessScreen
          log={submittedLog}
          photo={photo}
          officeCloseStr={officeCloseStr}
          onReset={resetForm}
          onRate={handleRate}
          queued={submittedQueued}
        />
      </>
    )
  }

  // ── PC Selection ──────────────────────────────────────────────────────────────
  if (step === 'pc-select') {
    const expectedOut = addHours(now, effectiveDuration)
    const pcList = pcs ?? []
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {officeState === 'closing_soon' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="font-bold text-amber-800 text-sm">Closing at {officeCloseStr}!</p>
            </div>
          )}

          {hasBoth && (
            <div className="bg-white rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full bg-[#0038A8] text-white flex items-center justify-center text-xs font-bold">1</div>
                <span className="text-sm font-semibold text-[#0038A8]">Choose PC</span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-2 flex-1 opacity-40">
                <div className="w-7 h-7 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-gray-400">WiFi Info</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#0038A8] mb-4">Choose a Workstation</h2>
            {pcList.length === 0
              ? <p className="text-center text-gray-300 py-8 text-sm">No workstations configured yet.</p>
              : <PcFloorGrid
                  pcs={pcList.map(p => ({
                    ...p,
                    id: p._id as string,
                    location: p.location ?? null,
                    logs: p.logs.map(l => ({ ...l, id: l.id as string, photoDataUrl: l.photoDataUrl ?? null })),
                  }))}
                  selectedId={form.pcId}
                  onSelect={id => setForm(f => ({ ...f, pcId: id }))}
                  now={now}
                />
            }
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-1">How long will you use it?</h3>
            <p className="text-xs text-gray-400 mb-3">Office closes at <strong>{officeCloseStr}</strong></p>
            <DurationPicker now={now} maxDuration={maxDuration} officeCloseStr={officeCloseStr}
              usageDuration={usageDuration} setUsageDuration={setUsageDuration}
              customDuration={customDuration} setCustomDuration={setCustomDuration}
              showCustom={showCustom} setShowCustom={setShowCustom} />
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Expected checkout:</span>
              <span className="font-bold text-[#0038A8]">{format(expectedOut, 'hh:mm a')}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('form')} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">← Back</button>
            <button onClick={handlePcNext} disabled={submitting}
              className="flex-[2] py-3 rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Spinner /> Submitting…</> : hasBoth ? 'Next: WiFi Info →' : form.pcId ? `Confirm — ${pcs?.find(p => p._id === form.pcId)?.name || ''} →` : 'Submit Without Workstation'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Internet Info / WiFi ──────────────────────────────────────────────────────
  if (step === 'internet-info') {
    const expectedOut = addHours(now, effectiveDuration)
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-lg mx-auto space-y-4">
          {hasBoth && (
            <div className="bg-white rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 opacity-50">
                <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
                <span className="text-sm font-semibold text-gray-400">PC Selected</span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full bg-[#0038A8] text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-[#0038A8]">WiFi Info</span>
              </div>
            </div>
          )}

          <div className="bg-[#0038A8] text-white rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">📶</div>
            <h2 className="text-2xl font-bold mb-1">Free WiFi</h2>
            <p className="text-blue-200 text-sm">{settings.wifiNote || 'Free public WiFi'}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
            {settings.wifiSsid && (
              <img src={wifiQrUrl(settings.wifiSsid, settings.wifiPassword || '')}
                alt="WiFi QR" className="w-44 h-44 rounded-xl border-4 border-gray-100" />
            )}
            <p className="text-xs text-gray-400">Scan with your phone camera to connect instantly</p>
            <div className="w-full bg-gray-50 rounded-xl px-5 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">Network (SSID)</span>
                <span className="font-mono font-bold text-gray-800 text-sm">{settings.wifiSsid || 'DTC-WiFi'}</span>
              </div>
              {settings.wifiPassword ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-semibold">Password</span>
                  <span className="font-mono font-bold text-gray-800 text-sm">{settings.wifiPassword}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-green-600 font-semibold">Open network — no password needed</span>
                </div>
              )}
            </div>
          </div>

          {!hasBoth && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">How long will you use the WiFi?</h3>
              <p className="text-xs text-gray-400 mb-3">Must finish before {officeCloseStr}</p>
              <DurationPicker now={now} maxDuration={maxDuration} officeCloseStr={officeCloseStr}
                usageDuration={usageDuration} setUsageDuration={setUsageDuration}
                customDuration={customDuration} setCustomDuration={setCustomDuration}
                showCustom={showCustom} setShowCustom={setShowCustom} />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-xs text-blue-400 mb-1">Expected departure</p>
            <p className="font-bold text-2xl text-[#0038A8]">{format(expectedOut, 'hh:mm a')}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => hasBoth ? setStep('pc-select') : setStep('form')}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">← Back</button>
            <button onClick={() => handleSubmit(form.pcId || undefined)} disabled={submitting}
              className="flex-[2] py-3 rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Spinner /> Submitting…</> : 'Confirm & Submit ✓'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {showPrivacyModal && <DataPrivacyModal onClose={() => setShowPrivacyModal(false)} />}
      {showRulesModal && <HouseRulesModal onClose={() => setShowRulesModal(false)} onAgree={() => { setRulesAgreed(true); setShowRulesModal(false) }} />}

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#0038A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg text-center mb-2">Photo Consent</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Your photo will be stored for identification per{' '}
              <button onClick={() => { setShowConsentModal(false); setShowPrivacyModal(true) }} className="text-[#0038A8] underline font-medium">RA 10173</button>.
            </p>
            <label className="flex items-start gap-3 mb-5 cursor-pointer" onClick={() => setConsentChecked(v => !v)}>
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${consentChecked ? 'bg-[#0038A8] border-[#0038A8]' : 'border-gray-300'}`}>
                {consentChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm text-gray-600">I consent to having my photo captured and stored with my logbook entry.</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => { setShowConsentModal(false); setConsentChecked(false) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">Decline</button>
              <button onClick={() => { if (!consentChecked) return; setShowConsentModal(false); startCamera() }}
                disabled={!consentChecked}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${consentChecked ? 'bg-[#0038A8] text-white hover:bg-blue-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                I Consent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Government Header */}
      <header className="bg-[#0038A8] sticky top-0 z-10 shadow-lg">
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]" />
          <div className="flex-1 bg-[#CE1126]" />
          <div className="flex-1 bg-[#FCD116]" />
        </div>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl">🏛️</span>
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm sm:text-base leading-tight truncate">Digital Transformation Center</div>
                <div className="text-blue-200 text-xs leading-tight">DICT Regional Office V · Bicol Region</div>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-center flex-shrink-0">
              <div className="font-mono text-white font-bold text-xl leading-none">{format(now, 'hh:mm:ss a')}</div>
              <div className="text-blue-200 text-xs mt-0.5">{format(now, 'EEEE, MMMM d, yyyy')}</div>
              {officeState === 'closing_soon' && (
                <div className="mt-1 bg-yellow-400 text-[#0038A8] text-xs font-bold px-3 py-0.5 rounded-full animate-pulse">
                  ⏰ Closes {officeCloseStr}
                </div>
              )}
            </div>
            <div className="flex sm:hidden flex-col items-end flex-shrink-0">
              <div className="font-mono text-white font-bold text-sm">{format(now, 'hh:mm a')}</div>
              <div className="text-blue-200 text-[10px]">{format(now, 'MMM d')}</div>
            </div>
          </div>
        </div>
        <div className="bg-white/10 border-t border-white/10">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Client Logbook System · Free ICT Services</p>
            <p className="text-blue-200/70 text-[10px] hidden sm:block">Serving Camarines Sur · Camarines Norte · Catanduanes · Masbate · Sorsogon · Albay</p>
          </div>
        </div>
      </header>

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <div>
          {announcements.map(ann => (
            <div key={ann._id} className={`px-4 py-3 text-sm flex items-start gap-3 ${
              ann.type === 'WARNING' || ann.type === 'MAINTENANCE' ? 'bg-amber-500 text-white'
              : ann.type === 'HOLIDAY' ? 'bg-red-600 text-white'
              : 'bg-[#0038A8] text-white'
            }`}>
              <span className="flex-shrink-0 mt-0.5">
                {ann.type === 'WARNING' ? '⚠️' : ann.type === 'MAINTENANCE' ? '🔧' : ann.type === 'HOLIDAY' ? '🎉' : 'ℹ️'}
              </span>
              <div>
                <span className="font-bold">{ann.title}</span>
                {ann.body && <span className="ml-1 opacity-90"> — {ann.body}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Connectivity / queue banner */}
        {(!isOnline || queuedCount > 0) && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-2xl px-4 py-3 flex items-center gap-3 border-2 ${
              !isOnline
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <span className="text-xl flex-shrink-0">
              {!isOnline ? '📡' : draining ? '🔄' : '⏱️'}
            </span>
            <div className="flex-1 text-sm">
              {!isOnline && queuedCount === 0 && (
                <span><strong>You're offline.</strong> You can still sign in — we'll sync when you reconnect.</span>
              )}
              {!isOnline && queuedCount > 0 && (
                <span>
                  <strong>Offline —</strong> {queuedCount} entr{queuedCount === 1 ? 'y' : 'ies'} saved on this device, waiting to sync.
                </span>
              )}
              {isOnline && queuedCount > 0 && (
                <span>
                  {draining
                    ? 'Syncing saved entries…'
                    : `${queuedCount} entr${queuedCount === 1 ? 'y' : 'ies'} waiting to sync.`}
                </span>
              )}
            </div>
            {isOnline && queuedCount > 0 && !draining && (
              <button
                onClick={manualRetry}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex-shrink-0"
              >
                Sync now
              </button>
            )}
          </div>
        )}

        {/* Hero */}
        <div className="bg-[#0038A8] text-white rounded-2xl p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Client Logbook</h1>
            <p className="text-blue-200 text-sm mt-0.5">Free Use of ICT Equipment and Internet Services</p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-blue-200 text-xs">Walk-in Service</span>
            <span className="text-white font-semibold text-sm">No Appointment Needed</span>
          </div>
        </div>

        {officeState === 'closing_soon' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-amber-800 text-sm font-semibold">Office closes at {officeCloseStr}. Duration is limited accordingly.</p>
          </div>
        )}

        {/* Photo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-700 text-sm">Client Photo</h3>
              <p className="text-xs text-gray-400">Optional — for identification</p>
            </div>
            {!photo && !cameraActive && (
              <button onClick={() => setShowConsentModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-[#0038A8] text-sm font-medium border border-blue-100 hover:bg-blue-100 transition-colors">
                📷 Take Photo
              </button>
            )}
          </div>
          {cameraError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-3">{cameraError}</div>}
          {cameraActive && !photo && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black w-full" style={{ aspectRatio: '4/3', maxHeight: '260px' }}>
                <video ref={videoCallbackRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">📷 Live Preview</div>
              </div>
              <div className="flex gap-2">
                <button onClick={capturePhoto} className="flex-1 py-3 bg-[#0038A8] text-white rounded-xl text-sm font-bold hover:bg-blue-800">📷 Capture</button>
                <button onClick={stopCamera} className="px-4 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          )}
          {photo && (
            <div className="flex items-center gap-4">
              <img src={photo} className="w-20 h-20 rounded-xl object-cover border-2 border-green-200" alt="" />
              <div>
                <p className="text-sm text-green-600 font-semibold">✓ Photo captured</p>
                <p className="text-xs text-gray-400">Stored securely with your entry</p>
                <button onClick={() => { setPhoto(null); startCamera() }} className="mt-1.5 text-xs text-blue-500 underline">Retake</button>
              </div>
            </div>
          )}
          {!cameraActive && !photo && !cameraError && (
            <p className="text-xs text-gray-300 italic">Click &ldquo;Take Photo&rdquo; above. Consent required.</p>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Form fields */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          <Field label="Full Name" required error={errors.fullName}>
            <input type="text" value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: sanitizeName(e.target.value) }))}
              placeholder="e.g. Juan A. dela Cruz" maxLength={80}
              className={iCls(!!errors.fullName)} />
            <p className="text-xs text-gray-300 mt-1">Include first name, middle initial, and last name.</p>
          </Field>

          <Field label="Agency / Organization / School" required error={errors.agency}>
            <input type="text" value={form.agency}
              onChange={e => setForm(f => ({ ...f, agency: sanitizeAgency(e.target.value) }))}
              placeholder="e.g. LGU Donsol, DepEd Sorsogon, Private Individual"
              maxLength={100} className={iCls(!!errors.agency)} />
          </Field>

          <Field label="Purpose / Service Availed" required error={errors.purpose}>
            <div className="relative">
              <textarea value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                onFocus={() => setPurposeFocus(true)}
                onBlur={() => setTimeout(() => setPurposeFocus(false), 150)}
                rows={2} placeholder="Type or select your purpose below…"
                className={iCls(!!errors.purpose) + ' resize-none'} />
              {purposeFocus && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 max-h-48 overflow-y-auto">
                  {purposeSuggestions.map(s => (
                    <button key={s} type="button"
                      onMouseDown={() => { setForm(f => ({ ...f, purpose: s })); setPurposeFocus(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-[#0038A8] transition-colors border-b border-gray-50 last:border-0 ${form.purpose === s ? 'bg-blue-50 text-[#0038A8] font-medium' : 'text-gray-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Equipment selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ICT Equipment / Service <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'Desktop Computer', icon: '🖥️', desc: 'Use a PC workstation', display: 'Desktop Computer', badge: '📧 Contact required' },
                { key: 'Internet Only', icon: '📶', desc: 'Connect your own device', display: 'Internet', badge: null },
              ].map(({ key, icon, desc, display, badge }) => {
                const sel = form.equipmentUsed.includes(key)
                return (
                  <button key={key} type="button" onClick={() => toggleEquipment(key)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${sel ? 'border-[#0038A8] bg-blue-50' : 'border-gray-200 hover:border-blue-200 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{icon}</span>
                      <span className="font-bold text-gray-800 text-base">{display}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    {badge && <span className="mt-2 inline-block text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5">{badge}</span>}
                  </button>
                )
              })}
            </div>
            {errors.equipment && <p className="text-red-500 text-xs mt-2">⚠ {errors.equipment}</p>}
          </div>

          {/* Contact info for PC users */}
          {hasPC && (
            <div className="rounded-2xl border-2 border-blue-200 overflow-hidden">
              <div className="bg-[#0038A8] px-4 py-3 flex items-center gap-3">
                <span className="text-xl">📧</span>
                <div>
                  <p className="font-bold text-white text-sm">Contact Information Required</p>
                  <p className="text-blue-200 text-xs">Needed for workstation borrowing records</p>
                </div>
              </div>
              <div className="p-4 bg-blue-50 space-y-3">
                <Field label="Email Address" error={errors.contact}>
                  <input type="email" value={form.contactEmail}
                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="e.g. juandelacruz@gmail.com" maxLength={200}
                    className={iCls(!!errors.contact)} />
                </Field>
                <Field label="Phone Number (optional)">
                  <input type="tel" value={form.contactPhone}
                    onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="e.g. 09XX-XXX-XXXX" maxLength={30}
                    className={iCls(false)} />
                </Field>
                <p className="text-[11px] text-gray-400">Your contact is stored securely per{' '}
                  <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-[#0038A8] underline">RA 10173</button>.
                </p>
              </div>
            </div>
          )}

          {/* House Rules */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <div onClick={() => setRulesAgreed(v => !v)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${rulesAgreed ? 'bg-[#0038A8] border-[#0038A8]' : 'border-gray-300 bg-white'}`}>
                {rulesAgreed && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12"><path fill="currentColor" d="M10 3L5 8.5 2 5.5 1 6.5 5 10.5 11 4z" /></svg>}
              </div>
              <p className="text-sm text-gray-700 leading-snug flex-1">
                I have read and agree to the{' '}
                <button type="button" onClick={() => setShowRulesModal(true)}
                  className="text-[#0038A8] font-bold underline hover:text-blue-800">
                  DTC House Rules and Guidelines
                </button>.
                I understand that violations may result in session termination.
              </p>
            </label>
            {errors.rules && <p className="text-red-500 text-xs mt-2">⚠ {errors.rules}</p>}
          </div>

          {/* Terms */}
          {(hasPC || hasWifi) && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="font-semibold uppercase tracking-wide">Terms of Use</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {hasPC && (
                <TermsBlock title="Computer / Workstation Use Agreement" icon="🖥️" color="text-blue-700"
                  terms={PC_TERMS} checked={pcTerms}
                  onChange={(i, v) => setPcTerms(prev => { const n = [...prev]; n[i] = v; return n })} />
              )}
              {hasWifi && (
                <TermsBlock title="Internet / WiFi Use Agreement" icon="📶" color="text-green-700"
                  terms={WIFI_TERMS} checked={wifiTerms}
                  onChange={(i, v) => setWifiTerms(prev => { const n = [...prev]; n[i] = v; return n })} />
              )}
              {errors.terms && <p className="text-red-500 text-xs flex items-center gap-1">⚠ {errors.terms}</p>}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600">Data Privacy Notice</p>
                  <p className="text-xs text-gray-400">Your data is handled per Philippine law</p>
                </div>
                <button type="button" onClick={() => setShowPrivacyModal(true)}
                  className="text-xs text-[#0038A8] font-semibold underline hover:text-blue-800 whitespace-nowrap">
                  View RA 10173 →
                </button>
              </div>
            </div>
          )}

          {/* Date/Time display */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Date</p>
              <p className="font-semibold text-gray-800 text-sm">{format(now, 'MMM d, yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Time In</p>
              <p className="font-mono text-[#0038A8] font-bold text-sm">{format(now, 'hh:mm:ss a')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Closes At</p>
              <p className="font-bold text-amber-600 text-sm">{officeCloseStr}</p>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3">
              <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700">Submission Error</p>
                <p className="text-xs text-red-600 mt-0.5">{submitError}</p>
              </div>
              <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none">×</button>
            </div>
          )}

          {/* Submit button */}
          <button onClick={handleNext}
            disabled={!rulesAgreed || (form.equipmentUsed.length > 0 && (!pcTermsOk || !wifiTermsOk))}
            className="w-full py-4 rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            {!rulesAgreed ? 'Please agree to the House Rules above'
              : !form.equipmentUsed.length ? 'Select a Service to Continue'
              : !pcTermsOk || !wifiTermsOk ? 'Please agree to all terms above'
              : hasPC && hasWifi ? '🖥️ Choose Workstation →'
              : hasPC ? '🖥️ Choose Workstation →'
              : '📶 View WiFi Info →'}
          </button>

          <p className="text-center text-xs text-gray-300">
            Collected per{' '}
            <button onClick={() => setShowPrivacyModal(true)} className="text-[#0038A8] underline font-medium">Data Privacy Act of 2012 (RA 10173)</button>
          </p>
        </div>

        <div className="text-center text-xs text-gray-400 pb-4">
          <p>DICT Region V · Legazpi City, Albay · © {new Date().getFullYear()}</p>
        </div>
      </main>
    </div>
  )
}
