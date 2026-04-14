"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { CURRENT_YEAR } from "@/lib/types";

interface DashboardFilterContextType {
  selectedProvince: Id<"provinces"> | "all";
  setSelectedProvince: (province: Id<"provinces"> | "all") => void;
  selectedYear: number | "all";
  setSelectedYear: (year: number | "all") => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedProgram: string;
  setSelectedProgram: (program: string) => void;
}

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [selectedProvince, setSelectedProvince] = useState<Id<"provinces"> | "all">("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState<string>("all");

  return (
    <DashboardFilterContext.Provider
      value={{
        selectedProvince,
        setSelectedProvince,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        selectedProgram,
        setSelectedProgram,
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const context = useContext(DashboardFilterContext);
  if (!context) {
    throw new Error("useDashboardFilters must be used within DashboardFilterProvider");
  }
  return context;
}
