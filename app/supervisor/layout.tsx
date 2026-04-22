import OfflineBanner from "@/components/OfflineBanner";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner stores={[]} />
      {children}
    </>
  );
}
