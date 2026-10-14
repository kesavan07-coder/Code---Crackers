"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, RefreshCw, ArrowRight } from "lucide-react";

import { usePortal } from "@/lib/portalContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function WaitingEvaluationContent() {
  const { user, token, logout, isLoading } = useAuth();
  const { portalSettings } = usePortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundStr = searchParams.get("round") || "1";
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [leaderboardPublished, setLeaderboardPublished] = useState<boolean | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    if (!token) return;
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`${API_BASE}/api/competition/leaderboard?round=${roundStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboardPublished(data.published);
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (token) fetchLeaderboard();
  }, [token, roundStr]);

  const handleRefreshStatus = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchLeaderboard();
    try {
      const res = await fetch(`${API_BASE}/api/competition/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
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
      <header className="w-full h-auto min-h-[56px] bg-white px-4 sm:px-6 md:px-12 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <img
            src={portalSettings.collegeLogo || "/college_logo.png"}
            alt={portalSettings.collegeName || "College Logo"}
            className="w-8 h-8 object-contain rounded-lg border border-neutral-200 p-0.5 bg-white"
          />
          <span className="font-extrabold text-lg uppercase tracking-tight leading-none text-black">
            {portalSettings.eventName || "Code Crackers"}
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
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-2xl bg-white border-2 border-neutral-200 rounded-3xl p-5 sm:p-8 shadow-2xl flex flex-col items-center text-center gap-4 sm:gap-6"
        >
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-black border border-neutral-200 mb-1">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold px-3.5 py-1.5 bg-zinc-100 rounded-full text-black inline-block mx-auto uppercase tracking-wider">
              ✅ Round {roundStr} Submitted Successfully
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-black leading-tight mt-1">
              Waiting for Evaluation
            </h1>
          </div>

          <p className="text-sm font-semibold text-black leading-relaxed max-w-md">
            Your submission has been recorded successfully. Please wait while organizers evaluate all participants.
          </p>

          <div className="w-full border-t border-neutral-100 my-1" />

          {/* Leaderboard Section */}
          <div className="w-full text-left">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-extrabold text-black flex items-center gap-2">
                <span>🏆</span> Round {roundStr} Leaderboard
              </h2>
              <button
                onClick={fetchLeaderboard}
                disabled={loadingLeaderboard}
                className="text-xs font-bold text-black border-2 border-neutral-200 hover:border-black rounded-lg px-3 py-1 transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw size={12} className={loadingLeaderboard ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {leaderboardPublished === false ? (
              <div className="p-5 rounded-2xl bg-stone-50 border-2 border-dashed border-neutral-200 text-center">
                <p className="text-sm font-bold text-black">Leaderboard Not Published Yet</p>
                <p className="text-xs text-neutral-500 mt-1">
                  The admin has not officially published the Round {roundStr} leaderboard. Once published, click Refresh to view rankings.
                </p>
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border-2 border-neutral-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 border-b border-neutral-200 text-neutral-500 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3 text-right">Time Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {leaderboard.map((item) => (
                      <tr
                        key={item.userId}
                        className={item.userId === user?.id ? "bg-zinc-50 font-bold text-black" : "hover:bg-stone-50"}
                      >
                        <td className="px-4 py-3 font-extrabold">
                          {item.rank === 1 ? "🥇 1" : item.rank === 2 ? "🥈 2" : item.rank === 3 ? "🥉 3" : `#${item.rank}`}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-bold text-black">{item.fullName}</span>
                            <span className="text-neutral-400 block text-[10px]">@{item.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-black">{item.score} pts</td>
                        <td className="px-4 py-3 text-right font-medium text-neutral-600">
                          {item.timeTakenSeconds !== null ? `${Math.floor(item.timeTakenSeconds / 60)}m ${item.timeTakenSeconds % 60}s` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="w-full border-t border-neutral-100 my-1" />

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleRefreshStatus}
              disabled={refreshing}
              className="w-full py-3.5 bg-white border-2 border-black text-black rounded-xl font-bold text-sm tracking-wide hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Checking..." : "Refresh Status"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-3.5 bg-black text-white rounded-xl font-bold text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
