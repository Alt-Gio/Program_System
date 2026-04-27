export default function Loading() {
  return (
    <div className="page-content space-y-6 animate-pulse">
      <div className="h-9 w-80 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-56 bg-gray-100 rounded-xl" />
      <div className="h-96 bg-gray-100 rounded-xl" />
    </div>
  );
}
