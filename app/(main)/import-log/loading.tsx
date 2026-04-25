export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-10 w-full animate-pulse rounded-full bg-gray-100" />
      <div className="grid flex-1 gap-4 lg:grid-cols-[5fr_7fr]">
        <div className="animate-pulse rounded-2xl bg-gray-100" />
        <div className="animate-pulse rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
