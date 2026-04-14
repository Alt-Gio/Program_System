'use client';

import { useState } from 'react';

export default function TestInternSyncPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testRegistration = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/interns/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Intern',
          email: `test${Date.now()}@example.com`,
          phone: '09123456789',
          school: 'Test University',
          course: 'BS Computer Science',
          department: 'College of Science',
          startDate: '2024-01-15',
          endDate: '2024-05-15',
          requiredHours: 486,
          sheetsInternId: `test_${Date.now()}`,
        }),
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testDTRSync = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/intern-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'UsGoSemX8JAtXdgzat05cInmZOYXbEv3',
        },
        body: JSON.stringify({
          type: 'dtr',
          internId: 'test@example.com',
          internName: 'Test Intern',
          internEmail: 'test@example.com',
          date: '2024-01-15',
          timeIn: '08:00',
          timeOut: '17:00',
          hours: 8,
          lateMin: 0,
          utMin: 0,
          remarks: 'Test DTR',
          timestamp: Date.now(),
        }),
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testActivitySync = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/intern-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'UsGoSemX8JAtXdgzat05cInmZOYXbEv3',
        },
        body: JSON.stringify({
          type: 'activity',
          internId: 'test@example.com',
          internName: 'Test Intern',
          internEmail: 'test@example.com',
          date: '2024-01-15',
          task: 'Test Task',
          program: 'Test Program',
          hours: 4,
          output: 'Test output',
          status: 'Done',
          rating: 5,
          remarks: 'Test activity',
          timestamp: Date.now(),
        }),
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/intern-sync');
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Intern Sync Integration Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Endpoints</h2>
          
          <div className="space-y-3">
            <button
              onClick={testHealthCheck}
              disabled={loading}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Test Health Check (GET /api/intern-sync)
            </button>
            
            <button
              onClick={testRegistration}
              disabled={loading}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              Test Registration (POST /api/interns/register)
            </button>
            
            <button
              onClick={testDTRSync}
              disabled={loading}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Test DTR Sync (POST /api/intern-sync)
            </button>
            
            <button
              onClick={testActivitySync}
              disabled={loading}
              className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
            >
              Test Activity Sync (POST /api/intern-sync)
            </button>
          </div>
        </div>
        
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-700">Loading...</p>
          </div>
        )}
        
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            
            {result.status && (
              <div className={`mb-4 px-4 py-2 rounded ${
                result.status >= 200 && result.status < 300
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                Status: {result.status}
              </div>
            )}
            
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Testing Notes</h3>
          <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
            <li>Registration creates a new intern with a unique email each time</li>
            <li>DTR and Activity sync will fail if the intern doesn't exist (404 error)</li>
            <li>Register an intern first, then use their email for sync tests</li>
            <li>Check the browser console and server logs for detailed error messages</li>
          </ul>
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-2">📚 Documentation</h3>
          <p className="text-blue-700 text-sm mb-2">
            For complete integration guide, see <code className="bg-blue-100 px-2 py-1 rounded">GOOGLE_SHEETS_INTEGRATION.md</code>
          </p>
          <p className="text-blue-700 text-sm">
            Webhook URL: <code className="bg-blue-100 px-2 py-1 rounded">http://127.0.0.1:3210/api/intern-sync</code>
          </p>
          <p className="text-blue-700 text-sm">
            Webhook Secret: <code className="bg-blue-100 px-2 py-1 rounded">UsGoSemX8JAtXdgzat05cInmZOYXbEv3</code>
          </p>
        </div>
      </div>
    </div>
  );
}
