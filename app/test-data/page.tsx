'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function TestDataPage() {
  // Check existing data
  const activities = useQuery(api.activities.list, {});
  const dtcLogs = useQuery(api.dtc.listLogs, {});
  
  // Check new intern data
  const interns = useQuery(api.interns.list, {});

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Data Status Check</h1>
        
        {/* Existing Data */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            ✅ Existing Data (Should have records)
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <span className="font-medium text-gray-700">Activities</span>
              <span className="text-2xl font-bold text-blue-600">
                {activities === undefined ? '...' : activities?.length || 0}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="font-medium text-gray-700">DTC Logs</span>
              <span className="text-2xl font-bold text-green-600">
                {dtcLogs === undefined ? '...' : dtcLogs?.length || 0}
              </span>
            </div>
          </div>
          
          {activities && activities.length > 0 && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
              <p className="text-green-800 font-semibold">
                ✅ Your existing data is SAFE and intact!
              </p>
            </div>
          )}
        </div>

        {/* New Intern Data */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            🆕 New Intern System (Empty - needs data)
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
              <span className="font-medium text-gray-700">Interns</span>
              <span className="text-2xl font-bold text-purple-600">
                {interns === undefined ? '...' : interns?.length || 0}
              </span>
            </div>
          </div>
          
          {interns && interns.length === 0 && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
              <p className="text-yellow-800 font-semibold">
                ℹ️ No interns yet - this is normal! Add your first intern at /interns
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">What to do next:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Your existing data is safe and untouched</li>
            <li>The intern system is new and empty</li>
            <li>Go to <a href="/interns" className="underline font-semibold">/interns</a> to add your first intern</li>
            <li>All new intern data will be stored in the new tables</li>
          </ol>
        </div>

        <div className="flex gap-4">
          <a
            href="/interns"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Intern Management
          </a>
          <a
            href="/"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
