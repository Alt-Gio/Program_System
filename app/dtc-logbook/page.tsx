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
        <div className="flex h-1 sm:h-1.5">
          <div className="flex-1 bg-[#0038A8]" />
          <div className="flex-1 bg-[#CE1126]" />
          <div className="flex-1 bg-[#FCD116]" />
        </div>
        
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4 py-2 sm:py-3">
            {/* LEFT - DICT Seal + Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl">🏛️</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white text-xs sm:text-sm md:text-base leading-tight truncate">
                  Digital Transformation Center
                </div>
                <div className="text-blue-200 text-[10px] sm:text-xs leading-tight truncate">
                  DICT Regional Office V · Bicol Region
                </div>
              </div>
            </div>

            {/* CENTER - Date/Time */}
            <div className="hidden md:flex flex-col items-center flex-shrink-0">
              <div className="font-mono text-white font-bold text-lg md:text-xl leading-none tracking-wide">
                {format(now, 'hh:mm:ss a')}
              </div>
              <div className="text-blue-200 text-[10px] md:text-xs mt-0.5">
                {format(now, 'EEEE, MMMM d, yyyy')}
              </div>
            </div>

            {/* RIGHT - Mobile time */}
            <div className="flex md:hidden flex-col items-end flex-shrink-0">
              <div className="font-mono text-white font-bold text-xs sm:text-sm">
                {format(now, 'hh:mm a')}
              </div>
              <div className="text-blue-200 text-[9px] sm:text-[10px]">
                {format(now, 'MMM d')}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom subtitle bar */}
        <div className="bg-white/10 border-t border-white/10">
          <div className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-1 sm:py-1.5 flex items-center justify-between gap-2">
            <p className="text-blue-100 text-[10px] sm:text-xs font-medium tracking-wide uppercase truncate">
              Client Logbook System · Free ICT Services
            </p>
            <p className="text-blue-200/70 text-[9px] sm:text-[10px] hidden md:block truncate">
              Serving Camarines Sur · Camarines Norte · Catanduanes · Masbate · Sorsogon · Albay
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
          {/* Hero */}
          <div className="bg-[#0038A8] text-white rounded-xl sm:rounded-2xl p-4 sm:p-5">
            <h1 className="text-lg sm:text-xl font-bold">Client Logbook</h1>
            <p className="text-blue-200 text-xs sm:text-sm mt-0.5">
              Free Use of ICT Equipment and Internet Services
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3 sm:space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Juan A. dela Cruz"
                className="w-full border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50"
              />
            </div>

            {/* Agency */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-1.5">
                Agency / Organization <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                placeholder="e.g. LGU Legazpi, DepEd Albay"
                className="w-full border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-1.5">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Describe your purpose..."
                rows={2}
                className="w-full border rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50 resize-none"
              />
            </div>

            {/* Equipment Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                ICT Equipment / Service <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    form.equipmentUsed.includes('Desktop Computer')
                      ? 'border-[#0038A8] bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                    <span className="text-2xl sm:text-3xl">🖥️</span>
                    <span className="font-bold text-gray-800 text-sm sm:text-base">Desktop Computer</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">Use a PC workstation</p>
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
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    form.equipmentUsed.includes('Internet Only')
                      ? 'border-[#0038A8] bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                    <span className="text-2xl sm:text-3xl">📶</span>
                    <span className="font-bold text-gray-800 text-sm sm:text-base">Internet</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">Connect your own device</p>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              className="w-full py-3 sm:py-4 rounded-lg sm:rounded-xl bg-[#0038A8] text-white font-bold hover:bg-blue-800 active:scale-[0.98] transition-all shadow-lg shadow-blue-100 text-sm sm:text-base"
            >
              Continue →
            </button>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] sm:text-xs text-gray-400 pb-4">
            <p>DICT Region V · Legazpi City, Albay · © {new Date().getFullYear()}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
