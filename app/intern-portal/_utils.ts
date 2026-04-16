export const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f59e0b","#10b981","#3b82f6","#14b8a6"];
export const avatarColor = (n: string) => AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length];
export const initials    = (n: string) => n.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
export const fmtH        = (h: number) => h <= 0 ? "0h" : `${Math.floor(h)}h ${Math.round((h % 1) * 60) > 0 ? Math.round((h % 1) * 60) + "m" : ""}`.trim();

export const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:    { label: "Active",   dot: "bg-green-400",  badge: "bg-green-50 text-green-700 border-green-200"   },
  COMPLETED: { label: "Done",     dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200"      },
  ON_LEAVE:  { label: "On Leave", dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200"   },
  INACTIVE:  { label: "Inactive", dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200"         },
};

export const ATT_BADGE: Record<string, string> = {
  PRESENT:  "bg-green-50 text-green-700 border-green-200",
  HALF_DAY: "bg-amber-50 text-amber-700 border-amber-200",
  ABSENT:   "bg-red-50 text-red-700 border-red-200",
  LEAVE:    "bg-purple-50 text-purple-700 border-purple-200",
  HOLIDAY:  "bg-sky-50 text-sky-700 border-sky-200",
};

export const TASK_BADGE: Record<string, string> = {
  PENDING:     "bg-gray-50 text-gray-500 border-gray-200",
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-200",
  COMPLETED:   "bg-green-50 text-green-700 border-green-200",
  CANCELLED:   "bg-red-50 text-red-500 border-red-200",
};

export const PRIORITY_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  URGENT: { dot: "bg-red-500",    badge: "bg-red-50 text-red-600",      label: "Urgent" },
  HIGH:   { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-600", label: "High"   },
  MEDIUM: { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-600",   label: "Medium" },
  LOW:    { dot: "bg-gray-300",   badge: "bg-gray-50 text-gray-500",     label: "Low"    },
};

export const DOC_TYPES = ["RESUME","NDA","REPORT","CERTIFICATE","ENDORSEMENT","MEDICAL","WORK_PLAN","APPLICATION","OTHER"] as const;

export const DOC_BADGE: Record<string, string> = {
  RESUME:       "bg-blue-50 text-blue-600 border-blue-200",
  NDA:          "bg-purple-50 text-purple-600 border-purple-200",
  REPORT:       "bg-green-50 text-green-600 border-green-200",
  CERTIFICATE:  "bg-amber-50 text-amber-600 border-amber-200",
  ENDORSEMENT:  "bg-sky-50 text-sky-600 border-sky-200",
  MEDICAL:      "bg-rose-50 text-rose-600 border-rose-200",
  WORK_PLAN:    "bg-indigo-50 text-indigo-600 border-indigo-200",
  APPLICATION:  "bg-teal-50 text-teal-600 border-teal-200",
  OTHER:        "bg-gray-50 text-gray-500 border-gray-200",
};
