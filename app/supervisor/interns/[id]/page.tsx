"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/interns/${id}`); }, [id, router]);
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <p className="text-gray-500 text-sm">Redirecting...</p>
      <Link href={`/interns/${id}`} className="text-blue-600 hover:underline text-sm">Open directly</Link>
    </div>
  );
}