"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, RefreshCw, ArrowRight } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function WaitingEvaluationContent() {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundStr = searchParams.get("round") || "1";
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  const handleRefreshStatus = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/competition/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // If next round is open or user permission changed, navigate back to dashboard
        if (data.currentRound > Number(roundStr) || data.user?.roundPermissions?.[Number(roundStr) + 1] === "open") {
          router.push("/dashboard");
          return;
        }
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* Navbar */}
      <header className="w-full h-16 bg-white px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <img
            src="/college_logo.png"
            alt="Muthayammal Engineering College"
            className="w-8 h-8 object-contain rounded-lg border border-neutral-200 p-0.5 bg-white"
          />
          <span className="font-extrabold text-lg uppercase tracking-tight leading-none text-black">
            Code Crackers
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold hidden md:inline-block text-neutral-500">
            Participant: <span className="text-black font-bold">{user?.fullName || user?.username}</span>
          </span>
          <button
            onClick={logout}
            className="text-sm font-bold uppercase tracking-wider text-black hover:text-neutral-500 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-xl bg-white border-2 border-neutral-200 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center gap-6"
        >
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-black border border-neutral-200 mb-2">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold px-3.5 py-1.5 bg-zinc-100 rounded-full text-black inline-block mx-auto uppercase tracking-wider">
              ✅ Round {roundStr} Submitted Successfully
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black leading-tight mt-2">
              Waiting for Evaluation
            </h1>
          </div>

          <p className="text-sm font-semibold text-black leading-relaxed max-w-md">
            Your submission has been recorded successfully. Please wait while the organizers evaluate your submission.
          </p>

          <div className="w-full border-t border-neutral-100 my-2" />

          {/* Status Box */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-stone-50 border border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Round Status</span>
              <span className="flex items-center gap-2 text-sm font-extrabold text-black">
                <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                🟢 Completed
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-stone-50 border border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Access Control</span>
              <span className="flex items-center gap-2 text-sm font-extrabold text-black">
                <Lock size={14} strokeWidth={2.5} />
                🔒 Locked
              </span>
            </div>
          </div>

          <p className="text-xs font-semibold text-neutral-500 leading-relaxed">
            Click &ldquo;Refresh Status&rdquo; after the organizers announce the results.
          </p>

          <div className="w-full border-t border-neutral-100 my-2" />

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleRefreshStatus}
              disabled={refreshing}
              className="w-full py-4 bg-white border-2 border-black text-black rounded-xl font-bold text-sm tracking-wide hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Checking..." : "Refresh Status"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-4 bg-black text-white rounded-xl font-bold text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Go to Dashboard
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function WaitingEvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
        </div>
      }
    >
      <WaitingEvaluationContent />
    </Suspense>
  );
}
