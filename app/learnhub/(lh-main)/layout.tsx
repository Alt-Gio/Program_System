"use client";

import { NotificationProvider } from "@/components/learnhub/notifications/NotificationProvider";
import { TopNav } from "@/components/learnhub/layout/TopNav";
import { MobileBottomNav } from "@/components/learnhub/layout/MobileBottomNav";
import { LeftPanel } from "@/components/learnhub/panels/LeftPanel";
import { RightPanel } from "@/components/learnhub/panels/RightPanel";

export default function LhMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <div className="lh-root">
        <TopNav />
        <div className="lh-main">
          <aside className="lh-left-panel">
            <LeftPanel />
          </aside>
          <main style={{ minWidth: 0 }}>
            {children}
          </main>
          <aside className="lh-right-panel">
            <RightPanel />
          </aside>
        </div>
        <MobileBottomNav />
      </div>
    </NotificationProvider>
  );
}
