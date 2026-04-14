'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

// Simplified version - you can expand this with the full code from your reference
export default function DTCLogbookPage() {
  const [now, setNow] = useState(new Date())
  const [form, setForm] = useState({
    fullName: '',
    agency: '',
    purpose: '',
    equipmentUsed: [] as string[],
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Government Header */}
      <header className="bg-[#0038A8] sticky top-0 z-10 shadow-lg">
        {/* Philippine flag colors */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]" />
          <div className="flex-1 bg-[#CE1126]" />
          <div className="flex-1 bg-[#FCD116]" />
        </div>
        
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3">
            {/* LEFT - DICT Seal + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🏛️</span>
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                  Digital Transformation Center
                </div>
                <div className="text-blue-200 text-xs leading-tight">
                  DICT Regional Office V · Bicol Region
                </div>
              </div>
            </div>

            {/* CENTER - Date/Time */}
            <div className="hidden sm:flex flex-col items-center flex-shrink-0">
              <div className="font-mono text-white font-bold text-xl leading-none tracking-wide">
                {format(now, 'hh:mm:ss a')}
              </div>
              <div className="text-blue-200 text-xs mt-0.5">
                {format(now, 'EEEE, MMMM d, yyyy')}
              </div>
            </div>

            {/* RIGHT - Mobile time */}
            <div className="flex sm:hidden flex-col items-end">
              <div className="font-mono text-white font-bold text-sm">
                {format(now, 'hh:mm a')}
              </div>
              <div className="text-blue-200 text-[10px]">
                {format(now, 'MMM d')}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom subtitle bar */}
        <div className="bg-white/10 border-t border-white/10">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">
              Client Logbook System · Free ICT Services
            </p>
            <p className="text-blue-200/70 text-[10px] hidden sm:block">
              Serving Camarines Sur · Camarines Norte · Catanduanes · Masbate · Sorsogon · Albay
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero */}
          <div className="bg-[#0038A8] text-white rounded-2xl p-5">
            <h1 className="text-xl font-bold">Client Logbook</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Free Use of ICT Equipment and Internet Services
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Juan A. dela Cruz"
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50"
              />
            </div>

            {/* Agency */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Agency / Organization <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                placeholder="e.g. LGU Legazpi, DepEd Albay"
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Describe your purpose..."
                rows={2}
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50 resize-none"
              />
            </div>

            {/* Equipment Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ICT Equipment / Service <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const hasPC = form.equipmentUsed.includes('Desktop Computer')
                    setForm({
                      ...form,
                      equipmentUsed: hasPC
                        ? form.equipmentUsed.filter((e) => e !== 'Desktop Computer')
                        : [...form.equipmentUsed, 'Desktop Computer'],
                    })
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    form.equipmentUsed.includes('Desktop Computer')
                      ? 'border-[#0038A8] bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🖥️</span>
                    <span className="font-bold text-gray-800 text-base">Desktop Computer</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">Use a PC workstation</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const hasInternet = form.equipmentUsed.includes('Internet Only')
                    setForm({
                      ...form,
                      equipmentUsed: hasInternet
                        ? form.equipmentUsed.filter((e) => e !== 'Internet Only')
                        : [...form.equipmentUsed, 'Internet Only'],
                    })
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    form.equipmentUsed.includes('Internet Only')
                      ? 'border-[#0038A8] bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">📶</span>
                    <span className="font-bold text-gray-800 text-base">Internet</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">Connect your own device</p>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              className="w-full py-4 rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 text-base"
            >
              Continue →
            </button>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400">
            <p>DICT Region V · Legazpi City, Albay · © {new Date().getFullYear()}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
