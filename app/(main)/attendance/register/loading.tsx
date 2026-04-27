export default function Loading() {
  return (
    <div className="page-content space-y-4 animate-pulse">
      <div className="h-8 w-60 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-96 bg-gray-100 rounded-xl" />
        <div className="h-96 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
