import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intern Portal — DTC Region V",
};

export default function InternAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-900/50">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <h1 className="text-white text-lg font-extrabold tracking-widest">DTC REGION V</h1>
          <p className="text-white/40 text-xs tracking-widest mt-0.5">INTERN PORTAL</p>
        </div>
        {children}
      </div>
    </div>
  );
}
