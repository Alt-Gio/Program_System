"use client";

import { Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, ShieldCheck, History } from "lucide-react";
import { StaffDirectoryTab } from "@/components/personnel/StaffDirectoryTab";
import { UserAccountsTab } from "@/components/personnel/UserAccountsTab";
import { RolesAccessTab } from "@/components/personnel/RolesAccessTab";
import { UserActivityTab } from "@/components/personnel/UserActivityTab";

export default function PersonnelPage() {
  const [tab, setTab] = useState("directory");

  return (
    <div className="page-content space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personnel</h1>
        <p className="text-sm text-gray-500">
          Staff directory, login accounts, and role management.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap gap-1">
          <TabsTrigger value="directory" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Staff Directory
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> User Accounts
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Roles & Access
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4">
          <StaffDirectoryTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <UserAccountsTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesAccessTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <UserActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
