import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ShieldCheck } from "lucide-react";

/**
 * Self-service signup is disabled. DICT accounts are created via
 * admin-issued invites. The /signup route stays reachable so the old
 * bookmark still resolves — it just explains the new flow.
 */
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white mb-4 shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Invite only</h1>
          <p className="text-sm text-gray-500 mt-1">DICT Region V — Program Management System</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>How to get an account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700">
            <p>
              Accounts are created by a DICT admin. Ask your supervisor or an
              admin to send you an invite — you'll receive an email with a link
              and a one-time verification code.
            </p>
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-blue-900">
              <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Already got an invite email?</div>
                <div className="text-xs text-blue-800 mt-1">
                  Click the link in the email to set your password. The link
                  expires after 7 days.
                </div>
              </div>
            </div>
            <div className="text-center pt-2">
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                Already have an account? Sign in →
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
