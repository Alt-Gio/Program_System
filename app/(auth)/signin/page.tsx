"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LogIn, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Role = "intern" | "supervisor" | "manager" | "admin";

function landingForRole(role: Role): string {
  switch (role) {
    case "intern":
    case "supervisor":
      return "/intern-portal";
    case "manager":
    case "admin":
      return "/dashboard";
    default:
      return "/";
  }
}

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sign-in failed");
      }

      toast.success(`Welcome back, ${data.user.fullName}`);

      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");
      const role = data.user.role as Role;

      // Respect callbackUrl only if the role can access it; otherwise bounce
      // to the role's canonical landing page.
      const fallback = landingForRole(role);
      router.push(callbackUrl || fallback);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white mb-4 shadow-lg">
            <span className="text-2xl font-bold">D5</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">DICT Region V</h1>
          <p className="text-sm text-gray-500 mt-1">Program Management System</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <LogIn className="w-6 h-6 text-blue-600" />
              Sign In
            </CardTitle>
            <CardDescription>
              One sign-in for interns, supervisors, managers, and admins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              New accounts are invite-only.{" "}
              <Link href="/" className="font-semibold text-blue-600 hover:underline">
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          DICT Region V — Legazpi City, Bicol
        </p>
      </div>
    </div>
  );
}
