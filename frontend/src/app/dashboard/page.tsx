"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface CompetitionState {
  currentRound: number;
  roundStatus: "locked" | "open" | "closed";
  competitionState: "idle" | "running" | "paused" | "ended";
  startedAt: string | null;
  endsAt: string | null;
}

/* ─── Round state config ──────────────────────────────────────── */
function getRoundState(compStatus: any, roundNumber: number) {
  if (!compStatus) return { locked: true, label: "Locked", variant: "locked" as const };

  // 1. Check user-specific overrides
  const userOverride = compStatus.user?.roundPermissions?.[roundNumber];
  if (userOverride) {
    if (userOverride === "open") {
      return { locked: false, label: "Active", variant: "active" as const };
    }
    if (userOverride === "disqualified") {
      return { locked: true, label: "Disqualified", variant: "disqualified" as const };
    }
    if (userOverride === "completed") {
      return { locked: true, label: "Completed", variant: "completed" as const };
    }
    if (userOverride === "locked") {
      return { locked: true, label: "Locked", variant: "locked" as const };
    }
    if (userOverride === "skipped") {
      return { locked: true, label: "Skipped", variant: "locked" as const };
    }
  }

  // 2. Fallback to global state
  const { currentRound, roundStatus } = compStatus;
  if (roundNumber === currentRound) {
    if (roundStatus === "open")   return { locked: false, label: "Active",    variant: "active"    as const };
    if (roundStatus === "closed") return { locked: true,  label: "Completed", variant: "completed" as const };
  }
  if (roundNumber < currentRound) return { locked: true, label: "Completed", variant: "completed" as const };
  return { locked: true, label: "Locked", variant: "locked" as const };
}

const STATE_STYLES = {
  active:    { color: "#ffffff", bg: "#000000", border: "#000000" },
  completed: { color: "#000000", bg: "#e4e4e7", border: "#e4e4e7" },
  locked:    { color: "#a1a1aa", bg: "#f4f4f5", border: "#f4f4f5" },
  disqualified: { color: "#ef4444", bg: "#fee2e2", border: "#fca5a5" },
};

export default function ParticipantDashboard() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [compStatus, setCompStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth hydration before redirecting
    if (!token) { router.replace("/login"); return; }
    if (user && user.role === "admin") { router.replace("/admin"); return; }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/competition/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCompStatus(data);
        
        // If not approved or competition is in idle state, redirect to waiting room
        if (data.competitionState === "idle" || (data.user && !data.user.isApproved)) {
          router.replace("/dashboard/waiting");
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 6000);
    return () => clearInterval(timer);
  }, [authLoading, token, user, router, logout]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  const roundDurations = compStatus?.roundDurations || { 1: 30, 2: 45, 3: 20 };

  const rounds = [
    {
      num: 1,
      title: "Basic Coding MCQ",
      description: "Solve 30 multiple-choice questions focused on data structures, algorithms, and core programming paradigms under a strict time limit.",
      duration: `${roundDurations[1] || 30} Minutes`,
      questions: "30 MCQs",
      route: "/round1",
      icon: "01",
    },
    {
      num: 2,
      title: "Story-Based Coding",
      description: "Tackle narrative coding challenges in Monaco Editor. Choose your language, write code, and run against visible test cases.",
      duration: `${roundDurations[2] || 45} Minutes`,
      questions: "3 Challenges",
      route: "/round2",
      icon: "02",
    },
    {
      num: 3,
      title: "Bug Hunter",
      description: "Review buggy code snippets, identify logic and syntax issues, implement clean fixes, and secure points before the timer runs out.",
      duration: `${roundDurations[3] || 20} Minutes`,
      questions: "5 Puzzles",
      route: "/round3",
      icon: "03",
    },
  ];

  const compState = compStatus?.competitionState || "idle";

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* ── Nav ── */}
      <header className="w-full h-16 bg-white px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <img
            src="/college_logo.png"
            alt="Muthayammal Engineering College"
            className="w-8 h-8 object-contain rounded-lg border border-neutral-200 p-0.5 bg-white"
          />
          {compState === "running" && (
            <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
          )}
          <span className="font-extrabold text-lg uppercase tracking-tight leading-none text-black">
            Code Crackers
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold hidden md:inline-block text-neutral-500">
            Welcome, <span className="text-black font-bold">{user?.fullName || user?.username}</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black hover:text-neutral-500 transition-colors cursor-pointer"
          >
            <LogOut size={16} strokeWidth={2.5} />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 md:px-12 py-10 flex flex-col gap-8">

        {/* Hero info bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 border border-neutral-200"
        >
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-black leading-none">
              Symposium<br/>Competition
            </h1>
            <p className="text-sm font-semibold text-neutral-500 mt-2">
              Rounds unlock sequentially — complete each in order.
            </p>
          </div>

          <div className="flex gap-4 font-bold text-sm flex-wrap">
            <div className="px-5 py-4 rounded-xl bg-zinc-100 flex flex-col gap-1 min-w-[120px]">
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Department</span>
              <span className="text-lg text-black leading-none">{user?.department || "CSBS"}</span>
            </div>

            <div className="px-5 py-4 rounded-xl bg-zinc-100 flex flex-col gap-1 min-w-[120px]">
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Status</span>
              <span className="text-lg text-black leading-none uppercase">{compState}</span>
            </div>
          </div>
        </motion.div>

        {/* Round cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rounds.map((round, idx) => {
            const state = getRoundState(compStatus, round.num);
            const styles = STATE_STYLES[state.variant];
            return (
               <motion.div
                key={round.num}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 * idx, ease: [0.16, 1, 0.3, 1] }}
                className={`group flex flex-col h-full rounded-2xl p-6 md:p-8 border border-neutral-200 transition-all duration-300 ${!state.locked ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1' : 'bg-neutral-50'}`}
              >
                <div className="flex items-start justify-between mb-8">
                   <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-lg font-bold text-black">
                      {round.icon}
                   </div>
                   <span
                    className="text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider"
                    style={{ color: styles.color, background: styles.bg }}
                   >
                    {state.label}
                   </span>
                </div>

                <h3 className="text-2xl font-bold tracking-tight leading-tight text-black mb-3">
                  {round.title}
                </h3>
                
                <p className="text-sm font-semibold leading-relaxed text-neutral-500 mb-8 flex-1">
                  {round.description}
                </p>

                <div className="flex flex-col gap-4 pt-6 border-t border-neutral-200">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-black">
                    <span>{round.questions}</span>
                    <span>{round.duration}</span>
                  </div>

                  {!state.locked ? (
                    <button
                      onClick={() => router.push(round.route)}
                      className="w-full py-4 bg-black rounded-xl text-white font-bold text-sm tracking-wide hover:bg-neutral-800 transition-colors"
                    >
                      Enter Round
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-4 bg-zinc-200 rounded-xl text-neutral-500 font-bold text-sm tracking-wide cursor-not-allowed"
                    >
                      {state.label === "Completed" ? "Submitted" : "Locked"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
