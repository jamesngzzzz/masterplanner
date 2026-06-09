"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-8 h-8 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
