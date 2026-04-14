"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function TestSessionPage() {
  const { data: session, status } = useSession();
  const [serverSession, setServerSession] = useState<any>(null);

  useEffect(() => {
    fetch('/api/test-auth')
      .then(r => r.json())
      .then(data => setServerSession(data));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Session Debug</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold text-lg mb-2">Client-Side Session (useSession)</h2>
        <p><strong>Status:</strong> {status}</p>
        <p><strong>Session exists:</strong> {session ? "Yes" : "No"}</p>
        <p><strong>User:</strong> {session?.user?.email}</p>
        <p><strong>Access Token:</strong> {(session as any)?.accessToken ? "Yes ✅" : "No ❌"}</p>
        
        <div className="mt-4 space-x-2">
          {!session ? (
            <button 
              onClick={() => signIn("google")}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Sign In with Google
            </button>
          ) : (
            <button 
              onClick={() => signOut()}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Sign Out
            </button>
          )}
        </div>
        
        <details className="mt-4">
          <summary className="cursor-pointer font-bold">Full Client Session</summary>
          <pre className="mt-2 text-xs overflow-auto bg-white p-2">
            {JSON.stringify(session, null, 2)}
          </pre>
        </details>
      </div>

      <div className="bg-blue-100 p-4 rounded">
        <h2 className="font-bold text-lg mb-2">Server-Side Session (API Route)</h2>
        <p><strong>Has Session:</strong> {serverSession?.hasSession ? "Yes ✅" : "No ❌"}</p>
        <p><strong>User:</strong> {serverSession?.user}</p>
        <p><strong>Access Token:</strong> {serverSession?.hasAccessToken ? "Yes ✅" : "No ❌"}</p>
        
        <details className="mt-4">
          <summary className="cursor-pointer font-bold">Full Server Session</summary>
          <pre className="mt-2 text-xs overflow-auto bg-white p-2">
            {JSON.stringify(serverSession, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
