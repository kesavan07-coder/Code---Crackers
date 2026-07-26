"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface CompetitionState {
  currentRound: number;
  roundStatus: "locked" | "open" | "closed";
  competitionState: "idle" | "running" | "paused" | "ended";
  startedAt: string | null;
  endsAt: string | null;
}

interface OnlineStats {
  onlineCount: number;
  totalParticipants: number;
}

function StatCard({ label, value, sub, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col gap-2 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">{label}</span>
      <span className="text-3xl font-extrabold tracking-tight" style={{ color: accent || "#000000" }}>
        {value}
      </span>
      {sub && <span className="text-xs font-semibold text-neutral-400">{sub}</span>}
    </div>
  );
}

function RoundControlCard({ round, label, description, duration, onOpen, isActive, isClosed, onClose }: {
  round: number;
  label: string;
  description: string;
  duration: number;
  onOpen: (round: number, mins: number) => void;
  isActive: boolean;
  isClosed: boolean;
  onClose: () => void;
}) {
  const [mins, setMins] = useState(duration);

  return (
    <div className={`bg-white rounded-2xl p-6 flex flex-col gap-5 border-2 transition-colors ${isActive ? 'border-black' : 'border-neutral-200'} shadow-[0_4px_20px_rgb(0,0,0,0.03)]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">ROUND 0{round}</span>
          <h3 className="text-base font-extrabold text-black mt-1">{label}</h3>
          <p className="text-xs mt-2 text-neutral-500 leading-relaxed">{description}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider whitespace-nowrap flex-shrink-0 ${isActive ? 'bg-black text-white' : isClosed ? 'bg-zinc-200 text-black' : 'bg-zinc-100 text-neutral-500'}`}>
          {isActive ? "● Live" : isClosed ? "Closed" : "Locked"}
        </span>
      </div>

      {!isActive && !isClosed && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-neutral-500 whitespace-nowrap uppercase tracking-widest">Duration (min):</label>
          <input
            type="number"
            min={5}
            max={120}
            value={mins}
            onChange={(e) => setMins(Number(e.target.value))}
            className="w-20 text-center text-sm font-bold bg-zinc-100 border-2 border-neutral-200 rounded-xl px-3 py-2 text-black focus:outline-none focus:border-black transition-colors"
          />
        </div>
      )}

      {isActive ? (
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          Close Round
        </button>
      ) : !isClosed ? (
        <button
          onClick={() => onOpen(round, mins)}
          className="w-full py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
        >
          Open Round
        </button>
      ) : (
        <div className="text-center text-xs font-bold py-3 bg-zinc-100 border-2 border-neutral-200 rounded-xl text-neutral-500 uppercase tracking-widest">
          Round completed
        </div>
      )}
    </div>
  );
}

function AdminNav({ active }: { active: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Questions", href: "/admin/questions" },
    { label: "Participants", href: "/admin/participants" },
    { label: "Security", href: "/admin/security" },
    { label: "Reports", href: "/admin/reports" },
  ];

  return (
    <header className="w-full h-16 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="flex items-center gap-4">
        <img
          src="/college_logo.png"
          alt="Muthayammal Engineering College Logo"
          className="w-9 h-9 object-contain rounded-xl border border-neutral-200 p-0.5 bg-white"
        />
        <div>
          <span className="font-extrabold text-base tracking-wider text-black uppercase block leading-none">Code Crackers</span>
          <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">ADMIN CONTROL CENTER</span>
        </div>
      </div>
      <nav className="flex items-center gap-2">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors cursor-pointer border-2 ${active === item.href ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-transparent hover:border-neutral-200'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="w-px h-5 mx-1 bg-neutral-200" />
        <button onClick={logout} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer text-neutral-400 hover:text-red-500 transition-colors">
          Logout
        </button>
      </nav>
    </header>
  );
}

export default function AdminDashboard() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [compStatus, setCompStatus] = useState<CompetitionState | null>(null);
  const [onlineStats, setOnlineStats] = useState<OnlineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, onlineRes, questionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/competition/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/competition/online-count`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/admin/questions/mcq`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statusRes.ok) setCompStatus(await statusRes.json());
      if (onlineRes.ok) setOnlineStats(await onlineRes.json());
      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setQuestionCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin") { router.replace("/dashboard"); return; }
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [token, user, router, fetchStatus]);

  const competitionAction = async (endpoint: string, body?: object) => {
    setActionLoading(endpoint);
    try {
      const res = await fetch(`${API_BASE}/api/competition/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (res.ok) { setCompStatus(data.status); showToast(data.message || "Done."); }
      else showToast(data.message || "Action failed.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setActionLoading(null); }
  };

  const openRound = async (round: number, durationMinutes: number) => {
    setActionLoading("open-round");
    try {
      const res = await fetch(`${API_BASE}/api/competition/open-round`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ round, durationMinutes }),
      });
      const data = await res.json();
      if (res.ok) { setCompStatus(data.status); showToast(`Round ${round} is now live!`); }
      else showToast(data.message || "Failed to open round.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setActionLoading(null); }
  };

  const closeRound = async () => {
    setActionLoading("close-round");
    try {
      const res = await fetch(`${API_BASE}/api/competition/close-round`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) { setCompStatus(data.status); showToast("Round closed."); }
      else showToast(data.message || "Failed.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  const isRunning = compStatus?.competitionState === "running";
  const isPaused = compStatus?.competitionState === "paused";
  const isIdle = !compStatus || compStatus.competitionState === "idle";
  const isEnded = compStatus?.competitionState === "ended";
  const currentRound = compStatus?.currentRound || 0;
  const roundStatus = compStatus?.roundStatus || "locked";

  const getRoundState = (round: number) => ({
    isActive: currentRound === round && roundStatus === "open",
    isClosed: currentRound > round || (currentRound === round && roundStatus === "closed"),
  });

  const rounds = [
    { round: 1, label: "Basic Coding MCQ", description: "30 multiple-choice questions on DSA, algorithms & CS fundamentals.", duration: 30 },
    { round: 2, label: "Story-Based Coding", description: "3 narrative coding challenges with visible & hidden test cases.", duration: 45 },
    { round: 3, label: "Bug Hunter", description: "5 buggy code snippets. Identify and fix all issues before time runs out.", duration: 20 },
  ];

  const stateLabel = isIdle ? "Idle" : isRunning ? "Running" : isPaused ? "Paused" : "Ended";
  const stateColor = isRunning ? "#000000" : isPaused ? "#D97706" : isEnded ? "#52525b" : "#a1a1aa";

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl border-2 ${toast.type === "success" ? "bg-white border-black text-black" : "bg-white border-red-500 text-red-600"}`}
          >
            {toast.type === "success" ? "✓" : "✕"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AdminNav active="/admin" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-12 py-10 flex flex-col gap-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard label="Competition State" value={stateLabel} accent={stateColor} />
          <StatCard
            label="Online Participants"
            value={onlineStats?.onlineCount ?? "—"}
            sub={`of ${onlineStats?.totalParticipants ?? "—"} registered`}
          />
          <StatCard
            label="Active Round"
            value={currentRound > 0 && roundStatus === "open" ? `Round ${currentRound}` : "None"}
            sub={roundStatus !== "locked" ? `Status: ${roundStatus}` : "No round active"}
          />
          <StatCard
            label="MCQ Questions"
            value={questionCount}
            sub={questionCount === 0 ? "No questions loaded" : "questions ready"}
          />
        </div>

        {/* Competition Control */}
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-black">Competition Controls</h2>
              <p className="text-sm font-semibold mt-1 text-neutral-500">Manage the overall competition lifecycle</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 ${isRunning ? 'bg-black border-black text-white' : 'bg-zinc-100 border-neutral-200 text-neutral-500'}`}>
              {isRunning && <span className="w-2 h-2 rounded-full animate-ping bg-white" />}
              {stateLabel.toUpperCase()}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isIdle && (
              <button
                disabled={!!actionLoading}
                onClick={() => competitionAction("start", { durationMinutes: 150 })}
                className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                {actionLoading === "start" ? "Starting…" : "▶ Start Competition"}
              </button>
            )}
            {isRunning && (
              <button
                disabled={!!actionLoading}
                onClick={() => competitionAction("pause")}
                className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-300 bg-white text-black hover:border-black transition-colors disabled:opacity-40"
              >
                {actionLoading === "pause" ? "Pausing…" : "⏸ Pause"}
              </button>
            )}
            {isPaused && (
              <button
                disabled={!!actionLoading}
                onClick={() => competitionAction("resume")}
                className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                {actionLoading === "resume" ? "Resuming…" : "▶ Resume"}
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                disabled={!!actionLoading}
                onClick={() => competitionAction("stop")}
                className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors disabled:opacity-40"
              >
                {actionLoading === "stop" ? "Stopping…" : "⏹ End Competition"}
              </button>
            )}
            {!isIdle && (
              <button
                disabled={!!actionLoading}
                onClick={() => competitionAction("reset")}
                className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors disabled:opacity-40"
              >
                {actionLoading === "reset" ? "Resetting…" : "↺ Reset"}
              </button>
            )}
          </div>
        </div>

        {/* Round Controls */}
        <div>
          <h2 className="text-2xl font-extrabold text-black mb-6">Round Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {rounds.map((r) => {
              const { isActive, isClosed } = getRoundState(r.round);
              return (
                <RoundControlCard
                  key={r.round}
                  round={r.round}
                  label={r.label}
                  description={r.description}
                  duration={r.duration}
                  isActive={isActive}
                  isClosed={isClosed}
                  onOpen={openRound}
                  onClose={closeRound}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => router.push("/admin/questions")}
            className="group rounded-2xl p-7 text-left flex items-center gap-6 transition-all border-2 border-neutral-200 bg-white hover:border-black cursor-pointer shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 bg-zinc-100">📝</div>
            <div>
              <div className="text-base font-extrabold text-black">Manage MCQ Questions</div>
              <div className="text-sm font-semibold mt-1 text-neutral-500 leading-relaxed">
                Add, edit, delete, or bulk import questions for Round 1
              </div>
              <div className="text-xs font-bold mt-3 text-black uppercase tracking-widest">
                {questionCount} questions loaded →
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push("/admin/participants")}
            className="group rounded-2xl p-7 text-left flex items-center gap-6 transition-all border-2 border-neutral-200 bg-white hover:border-black cursor-pointer shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 bg-zinc-100">👥</div>
            <div>
              <div className="text-base font-extrabold text-black">View Participants</div>
              <div className="text-sm font-semibold mt-1 text-neutral-500 leading-relaxed">
                Live scores, submission status, and anti-cheat tab-switch logs
              </div>
              <div className="text-xs font-bold mt-3 text-black uppercase tracking-widest">
                {onlineStats?.onlineCount ?? 0} online now →
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
