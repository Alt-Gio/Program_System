"use client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export default function StoragePage() {
  const stats = useQuery(api.learnhub_posts.getVideoStorageStats)

  if (!stats) return (
    <div className="page-content flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  const compressionRate = stats.total > 0
    ? Math.round((stats.compressed / stats.total) * 100)
    : 0

  return (
    <div className="page-content space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Video Storage</h1>
        <p className="text-gray-500 text-sm mt-1">GPU-compressed via RTX 3060 NVENC</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Videos", value: stats.total, color: "blue" },
          { label: "Compressed", value: stats.compressed, color: "green" },
          { label: "Pending", value: stats.uncompressed, color: "orange" },
          { label: "Compression Rate", value: `${compressionRate}%`, color: "purple" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${
              color === "blue" ? "text-blue-600" :
              color === "green" ? "text-green-600" :
              color === "orange" ? "text-orange-500" :
              "text-purple-600"
            }`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Storage Breakdown</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${compressionRate}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 w-16 text-right">
            {compressionRate}% done
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Total uploaded: {formatBytes(stats.totalOriginalBytes)}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Videos</h2>
          <span className="text-xs text-gray-500">{stats.total} total</span>
        </header>
        <div className="divide-y divide-gray-100">
          {stats.videos.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No videos uploaded yet.</p>
          )}
          {stats.videos.map(v => (
            <div key={v.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                v.compressed ? "bg-green-500" : "bg-orange-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {v.title || v.content || "Untitled"}
                </p>
                <p className="text-xs text-gray-500">
                  {v.contentType} · {formatBytes(v.sizeBytes)} ·{" "}
                  {new Date(v.createdAt).toLocaleDateString("en-PH")}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                v.compressed
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {v.compressed ? "Compressed" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
