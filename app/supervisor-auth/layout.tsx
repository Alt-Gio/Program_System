import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supervisor Portal — DTC Region V",
};

export default function SupervisorAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1b2a] via-[#112236] to-[#0d1b2a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/40">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
            </svg>
          </div>
          <h1 className="text-white text-lg font-extrabold tracking-widest">DTC REGION V</h1>
          <p className="text-white/40 text-xs tracking-widest mt-0.5">SUPERVISOR PORTAL</p>
        </div>
        {children}
      </div>
    </div>
  );
}
