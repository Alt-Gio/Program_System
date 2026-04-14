'use client'

import { useEffect } from 'react'

const INFO_CARDS = [
  { 
    icon: '🌐', 
    title: 'Free Internet Access', 
    desc: 'High-speed internet access for all walk-in clients at the Digital Transformation Center.', 
    color: 'from-blue-600/20 to-blue-800/10', 
    border: 'border-blue-500/20', 
    glow: 'hover:shadow-blue-500/10' 
  },
  { 
    icon: '📄', 
    title: 'Document Processing', 
    desc: 'Government online transactions, forms, and digital document services.', 
    color: 'from-indigo-600/20 to-indigo-800/10', 
    border: 'border-indigo-500/20', 
    glow: 'hover:shadow-indigo-500/10' 
  },
  { 
    icon: '🎓', 
    title: 'Digital Literacy', 
    desc: 'Free workshops and training sessions on digital skills for all ages.', 
    color: 'from-cyan-600/20 to-cyan-800/10', 
    border: 'border-cyan-500/20', 
    glow: 'hover:shadow-cyan-500/10' 
  },
  { 
    icon: '🏛️', 
    title: 'eGov Services', 
    desc: 'SSS, PhilHealth, Pag-IBIG, and other government online portals with staff assistance.', 
    color: 'from-violet-600/20 to-violet-800/10', 
    border: 'border-violet-500/20', 
    glow: 'hover:shadow-violet-500/10' 
  },
  { 
    icon: '🔒', 
    title: 'Cybersecurity Awareness', 
    desc: 'Free seminars on staying safe online and protecting personal data.', 
    color: 'from-emerald-600/20 to-emerald-800/10', 
    border: 'border-emerald-500/20', 
    glow: 'hover:shadow-emerald-500/10' 
  },
  { 
    icon: '📡', 
    title: 'Digital Connectivity', 
    desc: 'DICT Region V bridges the digital divide, bringing ICT services to communities.', 
    color: 'from-rose-600/20 to-rose-800/10', 
    border: 'border-rose-500/20', 
    glow: 'hover:shadow-rose-500/10' 
  },
]

const FB_ICON = (
  <svg className="w-full h-full fill-white" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

export function FacebookPageEmbed() {
  useEffect(() => {
    const init = () => {
      if ((window as any).FB) {
        (window as any).FB.XFBML.parse()
        return
      }
      if (document.getElementById('fb-sdk')) return
      
      const s = document.createElement('script')
      s.id = 'fb-sdk'
      s.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0&appId=3077260962663166'
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }
    init()
  }, [])

  return (
    <section className="py-16 sm:py-20 relative overflow-hidden border-t border-white/[.04]">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#1877F2]/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="mb-10">
          <p className="text-[#1877F2] text-[10px] font-black uppercase tracking-[.35em] mb-3">Social Media</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center p-2 flex-shrink-0">
              {FB_ICON}
            </span>
            DICT Region V Bicol
          </h2>
          <p className="text-gray-500 text-sm mt-2 ml-[52px]">Stay connected with official news, events, and digital services.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* FB embed — takes 3/5 columns */}
          <div className="lg:sticky lg:top-8 lg:col-span-3">
            <div className="relative">
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-b from-[#1877F2]/60 via-[#1877F2]/20 to-[#1877F2]/10 pointer-events-none" />
              <div className="relative rounded-2xl overflow-hidden" style={{ background: '#18191a' }}>
                {/* Header */}
                <div 
                  className="px-4 py-3.5 flex items-center gap-3"
                  style={{ 
                    background: 'linear-gradient(135deg,rgba(24,119,242,.18),rgba(24,119,242,.06))', 
                    borderBottom: '1px solid rgba(24,119,242,.25)' 
                  }}
                >
                  <div className="w-11 h-11 rounded-full bg-[#1877F2] p-2 flex-shrink-0 shadow-lg shadow-[#1877F2]/30">
                    {FB_ICON}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold text-sm">DICT Region V - Bicol</span>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                        <circle cx="12" cy="12" r="12" fill="#1877F2"/>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white"/>
                      </svg>
                    </div>
                    <p className="text-gray-500 text-[11px] mt-0.5">Official Government Page · DICT Region V</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      Live Feed
                    </span>
                    <a 
                      href="https://www.facebook.com/DICTRegionVBicol" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#1877F2] font-semibold hover:underline"
                    >
                      Open page →
                    </a>
                  </div>
                </div>
                <div className="h-px" style={{ background: 'linear-gradient(90deg,#1877F2,rgba(24,119,242,.3),transparent)' }} />

                {/* SDK-based embed — CSS scale to fill container */}
                <div id="fb-root" />
                <div className="w-full overflow-hidden relative" style={{ height: 660 }}>
                  <div 
                    style={{
                      position: 'absolute',
                      top: -90,
                      left: 0,
                      transformOrigin: 'top left',
                      transform: 'scale(1.25)',
                      width: '80%',
                      height: 'calc(100% + 90px)',
                    }}
                  >
                    <div
                      className="fb-page"
                      data-href="https://www.facebook.com/DICTRegionVBicol"
                      data-tabs="timeline"
                      data-width="500"
                      data-height="700"
                      data-small-header="true"
                      data-adapt-container-width="true"
                      data-hide-cover="true"
                      data-show-facepile="false"
                      data-colorscheme="dark"
                    />
                  </div>
                  {/* Transparent overlay to stretch fb visually */}
                  <style>{`
                    .fb_iframe_widget,
                    .fb_iframe_widget span,
                    .fb_iframe_widget iframe {
                      width: 100% !important;
                      min-width: 100% !important;
                    }
                    #fb-root { display: none; }
                  `}</style>
                </div>
              </div>
            </div>
            <a 
              href="https://www.facebook.com/DICTRegionVBicol" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-3 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-[#1877F2]/30 hover:scale-[1.01] border"
              style={{ background: '#1877F2', borderColor: 'rgba(24,119,242,.5)' }}
            >
              <span className="w-5 h-5 p-0.5">
                {FB_ICON}
              </span>
              Follow DICT Region V Bicol on Facebook
            </a>
          </div>

          {/* Info cards — 2/5 columns */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            {INFO_CARDS.map((card, i) => (
              <div 
                key={i}
                className={`group relative bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-4 cursor-default transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg ${card.glow}`}
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300">
                    {card.icon}
                  </span>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-0.5 group-hover:text-blue-200 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-white/50 text-xs leading-relaxed group-hover:text-white/70 transition-colors">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 gap-2.5 mt-1">
              {[
                { num: '12', label: 'Workstations', icon: '🖥️' },
                { num: 'Free', label: 'All Services', icon: '✅' },
                { num: '8–5PM', label: 'Mon–Fri', icon: '🕐' },
              ].map((s, i) => (
                <div 
                  key={i}
                  className="border border-white/[.07] rounded-xl p-3 text-center hover:bg-white/[.06] hover:-translate-y-0.5 transition-all cursor-default"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-white font-bold text-sm">{s.num}</div>
                  <div className="text-white/40 text-[10px] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
