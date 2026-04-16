"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { DashboardFilterProvider } from "@/components/layout/DashboardFilterContext";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      {/* On mobile: full-width (sidebar is off-canvas drawer).
          On desktop: respect collapsed/expanded sidebar width. */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ml-0 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <Header />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardFilterProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </DashboardFilterProvider>
    </SidebarProvider>
  );
}
