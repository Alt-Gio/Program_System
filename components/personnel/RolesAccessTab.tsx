"use client";

import { ShieldCheck } from "lucide-react";

type Perm = {
  name: string;
  admin: boolean | "created";
  supervisor: boolean | "created";
  mentor: boolean | "created";
  intern: boolean | "created";
  readonly: boolean | "created";
  note?: string;
};

const PERMISSIONS: Perm[] = [
  { name: "View activities",  admin: true,  supervisor: true,  mentor: true,      intern: true,  readonly: true  },
  { name: "Add activities",   admin: true,  supervisor: true,  mentor: true,      intern: false, readonly: false },
  { name: "Edit activities",  admin: true,  supervisor: true,  mentor: "created", intern: false, readonly: false, note: "Mentor can only edit activities they created" },
  { name: "Delete",           admin: true,  supervisor: true,  mentor: false,     intern: false, readonly: false },
  { name: "Import data",      admin: true,  supervisor: true,  mentor: true,      intern: false, readonly: false },
  { name: "Export",           admin: true,  supervisor: true,  mentor: true,      intern: true,  readonly: true  },
  { name: "Manage users",     admin: true,  supervisor: false, mentor: false,     intern: false, readonly: false },
  { name: "View reports",     admin: true,  supervisor: true,  mentor: true,      intern: false, readonly: true  },
  { name: "Generate reports", admin: true,  supervisor: true,  mentor: false,     intern: false, readonly: false },
  { name: "Connect sheets",   admin: true,  supervisor: true,  mentor: false,     intern: false, readonly: false },
  { name: "Sync sheets",      admin: true,  supervisor: true,  mentor: true,      intern: false, readonly: false },
];

export function RolesAccessTab() {
  const hasCreated = PERMISSIONS.some((p) =>
    [p.admin, p.supervisor, p.mentor, p.intern, p.readonly].some((v) => v === "created"),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This is a read-only reference of what each role can do. Role
          enforcement is applied in the Convex queries and API routes — edit a
          user's role from the <strong>User Accounts</strong> tab.
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Permission</th>
              <th className="px-3 py-2 text-center">Admin</th>
              <th className="px-3 py-2 text-center">Supervisor</th>
              <th className="px-3 py-2 text-center">Mentor</th>
              <th className="px-3 py-2 text-center">Intern</th>
              <th className="px-3 py-2 text-center">Readonly</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p, i) => (
              <tr
                key={p.name}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className="px-3 py-2 text-gray-800">
                  {p.name}
                  {p.note && (
                    <span className="ml-1 text-[10px] text-gray-400">*</span>
                  )}
                </td>
                <Cell v={p.admin} />
                <Cell v={p.supervisor} />
                <Cell v={p.mentor} />
                <Cell v={p.intern} />
                <Cell v={p.readonly} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasCreated && (
        <p className="text-[11px] text-gray-500">
          * Mentor can only edit activities they created.
        </p>
      )}
    </div>
  );
}

function Cell({ v }: { v: boolean | "created" }) {
  if (v === true)
    return <td className="px-3 py-2 text-center text-emerald-600">✓</td>;
  if (v === "created")
    return (
      <td className="px-3 py-2 text-center text-amber-600" title="Own records only">
        ✓*
      </td>
    );
  return <td className="px-3 py-2 text-center text-gray-300">—</td>;
}
