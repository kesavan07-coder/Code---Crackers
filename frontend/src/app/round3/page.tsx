"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useAntiCheat } from "@/hooks/useAntiCheat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface DebugQuestion {
  id: string;
  title: string;
  description: string;
  buggyCode: string;
  language: string;
  hints: string[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

interface SavedAnswer {
  fixedCode: string;
  language: string;
  lastSaved: string | null;
  isSubmitted: boolean;
  pointsEarned: number;
}

export default function Round3BugHunterPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<DebugQuestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("20:00");
  const [loading, setLoading] = useState(true);

  // States
  const [workspaceCode, setWorkspaceCode] = useState<string>("");
  const [savedAnswers, setSavedAnswers] = useState<Record<string, SavedAnswer>>({});
  const [submissionStatus, setSubmissionStatus] = useState<"in_progress" | "submitted">("in_progress");
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Verification Console
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    tested: boolean;
    isCorrect: boolean;
    participantOutput?: string;
    referenceOutput?: string;
    error?: string | null;
  } | null>(null);

  // Celebratory burst animation state
  const [showCelebration, setShowCelebration] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    setIsFullscreen(!!document.fullscreenElement);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  const handleTabSwitch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/round3/tab-switch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTabSwitchCount(data.tabSwitchCount);
        if (data.disqualified) {
          window.location.reload();
        }
      }
    } catch {}
  }, [token]);

  const { enterFullscreen } = useAntiCheat({
    disablePaste: true,
    disableRightClick: true,
    onTabSwitch: handleTabSwitch,
    onFullscreenExit: () => {},
  });

  const resumeTest = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Questions
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/round3/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) router.replace("/dashboard");
        return;
      }
      const data = await res.json();
      setQuestions(data.questions || []);
      setEndsAt(data.endsAt);

      if (data.submission) {
        setSubmissionStatus(data.submission.status);
        setSavedAnswers(data.submission.answerData || {});
        setTabSwitchCount(data.submission.tabSwitchCount || 0);
        if (data.submission.status === "submitted") {
          router.replace("/dashboard/waiting-evaluation?round=3");
          return;
        }
      }
    } catch {
      // keep load
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth hydration before redirecting
    if (!token) {
      router.replace("/login");
      return;
    }
    fetchData();
  }, [authLoading, token, router, fetchData]);

  // Load code on active question change
  useEffect(() => {
    if (questions.length === 0) return;
    const activeQ = questions[activeIdx];
    const saved = savedAnswers[activeQ.id];

    if (saved) {
      setWorkspaceCode(saved.fixedCode);
    } else {
      setWorkspaceCode(activeQ.buggyCode);
    }
    setVerificationResult(null);
  }, [activeIdx, questions, savedAnswers]);

  // Timer countdown
  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        handleFinalSubmit(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  // Autosave
  const triggerAutosave = useCallback(
    (codeToSave: string) => {
      if (submissionStatus === "submitted" || questions.length === 0) return;
      setAutosaveStatus("saving");

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        const activeQ = questions[activeIdx];
        try {
          const res = await fetch(`${API_BASE}/api/round3/save`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              questionId: activeQ.id,
              fixedCode: codeToSave,
              language: activeQ.language,
            }),
          });
          if (res.ok) {
            setAutosaveStatus("saved");
            setSavedAnswers((prev) => ({
              ...prev,
              [activeQ.id]: {
                fixedCode: codeToSave,
                language: activeQ.language,
                lastSaved: new Date().toISOString(),
                isSubmitted: false,
                pointsEarned: 0,
              },
            }));
          } else {
            setAutosaveStatus("error");
          }
        } catch {
          setAutosaveStatus("error");
        }
      }, 1000);
    },
    [token, activeIdx, questions, submissionStatus]
  );

  const handleEditorChange = (val: string | undefined) => {
    const codeVal = val || "";
    setWorkspaceCode(codeVal);
    triggerAutosave(codeVal);
  };

  // Verify Fix
  const handleVerify = async () => {
    if (questions.length === 0) return;
    setIsVerifying(true);
    setVerificationResult(null);

    const activeQ = questions[activeIdx];
    try {
      const res = await fetch(`${API_BASE}/api/round3/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: activeQ.id,
          fixedCode: workspaceCode,
          language: activeQ.language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerificationResult({
          tested: true,
          isCorrect: data.isCorrect,
          participantOutput: data.participantOutput,
          referenceOutput: data.referenceOutput,
          error: data.error,
        });
      } else {
        setVerificationResult({
          tested: true,
          isCorrect: false,
          error: "Verification failed on server.",
        });
      }
    } catch {
      setVerificationResult({
        tested: true,
        isCorrect: false,
        error: "Network error during verification.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Final submit with Confetti animation
  const handleFinalSubmit = async (auto = false) => {
    if (submissionStatus === "submitted") return;
    if (!auto && !confirm("Are you sure you want to final submit Round 3? Your code will be scored instantly.")) {
      return;
    }

    setIsSubmittingRound(true);
    try {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      const res = await fetch(`${API_BASE}/api/round3/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // Trigger celebratory moment!
        setShowCelebration(true);
        // Let user enjoy celebration, then redirect via window.location
        setTimeout(() => {
          setSubmissionStatus("submitted");
          window.location.href = "/dashboard/waiting-evaluation?round=3";
        }, 2500);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.message && errData.message.toLowerCase().includes("already submitted")) {
          window.location.href = "/dashboard/waiting-evaluation?round=3";
          return;
        }
        alert(errData.message || "Failed to submit Round 3.");
        setIsSubmittingRound(false);
      }
    } catch (err) {
      console.error("Submit Round 3 error:", err);
      window.location.href = "/dashboard/waiting-evaluation?round=3";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  const activeQuestion = questions[activeIdx];
  const activeDiff = activeQuestion?.difficulty;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      
      {/* ── Celebratory Submission Overlay ── */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-center flex flex-col items-center gap-6 max-w-md px-6"
            >
              <div className="text-7xl animate-bounce">🏆</div>
              <h2 className="text-4xl font-extrabold tracking-tight text-black">
                Round 3 Completed!
              </h2>
              <p className="text-sm font-semibold text-neutral-500 leading-relaxed">
                Congratulations! You have successfully submitted the final round of the Code Crackers competition. Your bugs have been hunted and fixes are recorded.
              </p>
              
              {/* Particle animation container using CSS */}
              <div className="relative w-40 h-8 flex justify-center overflow-visible">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: i % 2 === 0 ? "#000000" : "#a1a1aa",
                      left: "50%",
                      top: "50%",
                      animation: `explode ${1 + Math.random() * 1.5}s ease-out infinite`,
                      transform: `rotate(${i * 30}deg) translate(0px)`,
                    }}
                  />
                ))}
              </div>

              <span className="text-xs font-bold tracking-widest uppercase text-neutral-400 mt-4">
                Redirecting to dashboard...
              </span>
            </motion.div>
            
            <style>{`
              @keyframes explode {
                0% { transform: rotate(var(--r, 0deg)) translate(0px) scale(1); opacity: 1; }
                100% { transform: rotate(var(--r, 0deg)) translate(80px) scale(0); opacity: 0; }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <header className="w-full h-16 px-6 flex items-center justify-between sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/college_logo.png"
              alt="Muthayammal Engineering College"
              className="w-7 h-7 object-contain rounded border border-neutral-200 p-0.5 bg-white"
            />
            <span className="font-extrabold text-sm tracking-widest uppercase text-black">
              ROUND 03: BUG HUNTER
            </span>
          </div>
          <div className="flex gap-2">
            {questions.map((q, idx) => {
              const isCurrent = activeIdx === idx;
              const hasAnswer = savedAnswers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-2 ${
                    isCurrent
                      ? "bg-black border-black text-white"
                      : hasAnswer
                      ? "bg-zinc-200 border-zinc-200 text-black"
                      : "bg-white border-transparent text-neutral-500 hover:border-neutral-200"
                  }`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Autosave */}
          <span className="text-xs font-bold text-neutral-500 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                autosaveStatus === "saving"
                  ? "bg-yellow-500 animate-pulse"
                  : autosaveStatus === "error"
                  ? "bg-red-500"
                  : "bg-black"
              }`}
            />
            {autosaveStatus === "saving" ? "SAVING..." : autosaveStatus === "error" ? "ERROR" : "AUTOSAVED"}
          </span>

          <div className="text-xl font-bold tabular-nums tracking-tighter text-black px-4 py-1.5 rounded-xl bg-zinc-100 border border-neutral-200">
            {timeLeft}
          </div>

          {submissionStatus !== "submitted" ? (
             <button
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmittingRound}
                className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Finish Round
              </button>
          ) : (
            <button
              disabled
              className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-zinc-200 text-neutral-500 cursor-not-allowed"
            >
              Submitted
            </button>
          )}
        </div>
      </header>

      {/* ── Main content pane (3-column/split layout) ── */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Question Narrative & Description */}
        <section className="w-1/3 p-6 overflow-y-auto flex flex-col gap-6 bg-stone-50 border-r border-neutral-200">
          {activeQuestion && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full uppercase bg-zinc-200 text-black">
                    {activeDiff}
                  </span>
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                    POINTS: {activeQuestion.points}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-black mt-2 leading-tight">
                  {activeQuestion.title}
                </h1>
              </div>

              {/* Supposed Behavior Instruction */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                  Problem Description
                </span>
                <div className="rounded-2xl p-6 bg-white border border-neutral-200 text-sm leading-relaxed text-neutral-700 shadow-[0_4px_20px_rgb(0,0,0,0.03)] whitespace-pre-wrap">
                  {activeQuestion.description}
                </div>
              </div>

              {/* Buggy Reference Code (Visual Only) */}
              <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
                <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                  Original Buggy Code
                </span>
                <div className="flex-1 rounded-2xl overflow-hidden border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-[#1e1e1e] relative">
                  <div className="absolute top-3 right-3 z-20 bg-red-950/40 border border-red-900/50 text-red-400 font-bold tracking-widest text-[10px] px-3 py-1.5 rounded-lg uppercase">
                    Buggy Reference
                  </div>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={activeQuestion.language === "cpp" ? "cpp" : activeQuestion.language === "python" ? "python" : "javascript"}
                    value={activeQuestion.buggyCode}
                    options={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      minimap: { enabled: false },
                      readOnly: true,
                      lineNumbers: "on",
                      padding: { top: 20 },
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right Side: Workspace Pane */}
        <section className="flex-1 flex flex-col relative bg-[#1e1e1e]">
          {/* Workspace header / actions */}
          <div className="h-14 border-b border-[#333333] px-6 flex items-center justify-between bg-[#1e1e1e]">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Your Workspace ({activeQuestion?.language})
            </span>

            <button
              onClick={handleVerify}
              disabled={isVerifying || submissionStatus === "submitted"}
              className="px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer transition-colors border-2 border-[#404040] bg-[#2d2d2d] text-white hover:border-white disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Verify Fix"}
            </button>
          </div>

          {/* Monaco Workspace */}
          <div className="flex-1 min-h-0 relative">
            {submissionStatus === "submitted" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center gap-4">
                <span className="text-4xl">🔒</span>
                <span className="text-base font-bold text-white tracking-widest uppercase">
                  Submission locked
                </span>
              </div>
            )}
            <Editor
              height="100%"
              theme="vs-dark"
              language={activeQuestion?.language === "cpp" ? "cpp" : activeQuestion?.language === "python" ? "python" : "javascript"}
              value={workspaceCode}
              options={{
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                minimap: { enabled: false },
                readOnly: submissionStatus === "submitted",
              }}
              onChange={handleEditorChange}
            />
          </div>

          {/* Verification Results Panel */}
          <AnimatePresence>
            {verificationResult && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "35%" }}
                exit={{ height: 0 }}
                className="absolute bottom-0 left-0 right-0 z-30 border-t border-[#333333] flex flex-col bg-[#1e1e1e]"
              >
                <div className="h-12 border-b border-[#333333] px-6 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Verification Status</span>
                  <button
                    onClick={() => setVerificationResult(null)}
                    className="text-neutral-400 hover:text-white cursor-pointer text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-white">
                  <div
                    className={`rounded-xl p-5 border-2 ${
                      verificationResult.isCorrect
                        ? "bg-green-950/20 border-green-500/30 text-green-400"
                        : "bg-red-950/20 border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between text-sm mb-3">
                      <span>
                        {verificationResult.isCorrect ? "✓ BUG FIXED SUCCESSFULLY!" : "✕ FIX FAILED"}
                      </span>
                    </div>

                    {verificationResult.error && (
                      <div className="text-red-400 whitespace-pre-wrap text-xs bg-red-950/40 p-3 rounded-lg border border-red-900/50">
                        {verificationResult.error}
                      </div>
                    )}

                    {!verificationResult.error && (
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono text-neutral-300 mt-2">
                        <div>
                          <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1.5">Reference Output</span>
                          <pre className="bg-[#2d2d2d] p-3 rounded-lg overflow-x-auto whitespace-pre border border-[#404040]">
                            {verificationResult.referenceOutput || "empty"}
                          </pre>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1.5">Your Output</span>
                          <pre className="bg-[#2d2d2d] p-3 rounded-lg overflow-x-auto whitespace-pre border border-[#404040]">
                            {verificationResult.participantOutput || "empty"}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
