// Pass-through layout — the real intern portal is at app/intern-portal/
// This file exists only because the directory was created as a route group by mistake.

export default function PassThrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
