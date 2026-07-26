"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

interface AnswerState {
  answer: number | null;
  markedForReview: boolean;
}

const DIFF_STYLES = {
  easy:   { color: "#000000", bg: "#e4e4e7", border: "#e4e4e7" },
  medium: { color: "#000000", bg: "#d4d4d8", border: "#d4d4d8" },
  hard:   { color: "#ffffff", bg: "#000000", border: "#000000" },
};

export default function Round1Page() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [questions, setQuestions]             = useState<Question[]>([]);
  const [answers, setAnswers]                 = useState<Record<string, AnswerState>>({});
  const [currentIdx, setCurrentIdx]           = useState(0);
  const [timeLeft, setTimeLeft]               = useState<number>(0);
  const [loading, setLoading]                 = useState(true);
  const [submitting, setSubmitting]           = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccess, setShowSuccess]         = useState(false);
  const [tabSwitchCount, setTabSwitchCount]   = useState(0);
  const [isFullscreen, setIsFullscreen]       = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleRoundComplete = useCallback(() => {
    window.location.href = "/dashboard/waiting-evaluation?round=1";
  }, []);

  const saveProgress = useCallback(
    async (updatedAnswers: Record<string, AnswerState>) => {
      if (!token) return;
      try {
        await fetch(`${API_BASE}/api/round1/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ answerData: updatedAnswers }),
        });
      } catch {}
    },
    [token]
  );

  const handleTabSwitch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/round1/tab-switch`, {
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

  useEffect(() => {
    if (authLoading) return; // Wait for auth hydration before redirecting
    if (!token) { router.replace("/login"); return; }

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/round1/questions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) throw new Error();

        const data = await res.json();
        setQuestions(data.questions);
        setAnswers(data.submission.answerData || {});
        setTabSwitchCount(data.submission.tabSwitchCount || 0);

        if (data.submission.status === "submitted") { handleRoundComplete(); return; }

        const endTime = new Date(data.endsAt).getTime();
        setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
        await enterFullscreen();
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, token, router, enterFullscreen, handleRoundComplete]);

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    const newAnswers = {
      ...answers,
      [questionId]: { ...answers[questionId], answer: optionIdx },
    };
    setAnswers(newAnswers);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveProgress(newAnswers);
  };

  const handleToggleReview = (questionId: string) => {
    const isMarked = answers[questionId]?.markedForReview || false;
    const newAnswers = {
      ...answers,
      [questionId]: { ...answers[questionId], markedForReview: !isMarked },
    };
    setAnswers(newAnswers);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveProgress(newAnswers);
  };

  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); handleSubmitRound(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, timeLeft]);

  const handleSubmitRound = async (force: boolean = false) => {
    if (submitting) return;
    // If called manually (not forced by timer), show confirm modal first
    if (!force && !showConfirmModal) {
      setShowConfirmModal(true);
      return;
    }
    setSubmitting(true);
    try {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      // Include latest answerData so submit atomically saves answers + status in one DB write
      const res = await fetch(`${API_BASE}/api/round1/submit`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ answerData: answers }),
      });
      if (res.ok) {
        if (force) {
          // Timer-forced auto-submit: go directly to waiting page
          handleRoundComplete();
        } else {
          // Manual submit via confirm modal: show success screen first
          setShowSuccess(true);
          setTimeout(() => handleRoundComplete(), 3000);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.message && errData.message.toLowerCase().includes("already submitted")) {
          setShowSuccess(true);
          setTimeout(() => handleRoundComplete(), 3000);
          return;
        }
        alert(errData.message || "Failed to submit Round 1.");
        setSubmitting(false);
        setShowConfirmModal(false);
      }
    } catch (err) {
      console.error("Submit error:", err);
      handleRoundComplete();
    }
  };

  const formatTimer = (sec: number) => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.values(answers).filter((a) => a.answer !== null).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const activeAnswer    = answers[currentQuestion?.id]?.answer;
  const isMarkedReview  = answers[currentQuestion?.id]?.markedForReview;
  const diff            = currentQuestion?.difficulty;
  const diffStyle       = diff ? DIFF_STYLES[diff] : DIFF_STYLES.easy;
  const isDanger        = timeLeft <= 60 && timeLeft > 0;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* ── Top Bar ── */}
      <header className="w-full h-16 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <img
            src="/college_logo.png"
            alt="Muthayammal Engineering College"
            className="w-7 h-7 object-contain rounded border border-neutral-200 p-0.5 bg-white"
          />
          <span className="font-extrabold text-sm tracking-widest uppercase text-black">
            Round 1 — MCQ
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">
              TIME
            </span>
            <span
              className={`text-2xl font-bold tabular-nums tracking-tighter ${isDanger ? "animate-pulse text-red-600" : "text-black"}`}
            >
              {formatTimer(timeLeft)}
            </span>
          </div>

          <div className="h-6 w-px bg-neutral-200 hidden md:block" />

          <span className="text-xs font-semibold hidden md:block text-neutral-500">
            Tab switches:{" "}
            <span className={`font-bold ${tabSwitchCount > 2 ? "text-red-600" : "text-black"}`}>
              {tabSwitchCount}
            </span>
          </span>

          <span className="text-xs font-semibold hidden md:block text-neutral-500">
            Answered:{" "}
            <span className="text-black font-bold">
              {answeredCount}/{questions.length}
            </span>
          </span>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto px-6 md:px-12 py-8 gap-8 overflow-hidden">
        
        {/* ── Question Pane ── */}
        <main className="flex-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-8 md:p-10 flex flex-col gap-8 flex-1 border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            
            {/* Question header */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-bold px-4 py-2 rounded-full bg-zinc-100 text-black">
                Q {currentIdx + 1} / {questions.length}
              </span>
              <span
                className="text-xs font-bold px-3 py-2 rounded-full uppercase tracking-wider"
                style={{ color: diffStyle.color, background: diffStyle.bg }}
              >
                {diff}
              </span>
            </div>

            {/* Question text */}
            <h2 className="text-2xl md:text-3xl font-extrabold leading-tight text-black">
              {currentQuestion?.questionText}
            </h2>

            {/* Options */}
            <div className="grid grid-cols-1 gap-4 flex-1">
              {currentQuestion?.options.map((optionText, idx) => {
                const isSelected = activeAnswer === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(currentQuestion.id, idx)}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-5 cursor-pointer group ${isSelected ? 'border-black bg-black' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${isSelected ? 'border-white bg-white text-black' : 'border-neutral-300 bg-transparent text-neutral-400 group-hover:border-black group-hover:text-black'}`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className={`text-base font-semibold leading-snug ${isSelected ? 'text-white' : 'text-black'}`}>
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation toolbar */}
            <div className="flex items-center justify-between border-t border-neutral-200 pt-6 mt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                  disabled={currentIdx === 0}
                  className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors border-2 border-neutral-200 bg-white text-black hover:border-black disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-200"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))}
                  disabled={currentIdx === questions.length - 1}
                  className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors border-2 border-neutral-200 bg-white text-black hover:border-black disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-neutral-200"
                >
                  Next →
                </button>
              </div>

              <button
                onClick={() => handleToggleReview(currentQuestion.id)}
                className={`px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase transition-colors border-2 ${isMarkedReview ? 'border-black bg-zinc-100 text-black' : 'border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black'}`}
              >
                {isMarkedReview ? "★ Marked" : "☆ Mark"}
              </button>
            </div>
          </div>
        </main>

        {/* ── Question Palette Panel ── */}
        <aside className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 md:p-8 flex flex-col gap-6 border border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">
              Palette
            </span>

            {/* Palette grid */}
            <div className="grid grid-cols-5 gap-3 max-h-[350px] overflow-y-auto pr-2">
              {questions.map((q, idx) => {
                const ans       = answers[q.id];
                const isCurrent = idx === currentIdx;
                const isAnswered = ans && ans.answer !== null;
                const isMarked  = ans && ans.markedForReview;

                let bgClass = "bg-zinc-100";
                let textClass = "text-neutral-500";
                let borderClass = "border-transparent";

                if (isCurrent) {
                  bgClass = "bg-black";
                  textClass = "text-white";
                } else if (isMarked) {
                  bgClass = "bg-zinc-200";
                  borderClass = "border-black";
                  textClass = "text-black";
                } else if (isAnswered) {
                  bgClass = "bg-zinc-200";
                  textClass = "text-black";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-11 h-11 rounded-xl border-2 font-bold flex items-center justify-center transition-transform hover:scale-110 ${bgClass} ${textClass} ${borderClass}`}
                  >
                    {(idx + 1).toString().padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-6 text-sm font-semibold">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border-2 border-transparent bg-zinc-100" />
                <span className="text-neutral-500">Unanswered</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border-2 border-transparent bg-zinc-200" />
                <span className="text-black">Answered</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border-2 border-black bg-zinc-200" />
                <span className="text-black">Marked for Review</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border-2 border-transparent bg-black" />
                <span className="text-black">Current</span>
              </div>
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-4 border-t border-neutral-200">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-neutral-500">Progress</span>
                <span className="text-black">
                  {answeredCount} / {questions.length}
                </span>
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-4 bg-black rounded-xl text-white font-bold text-sm tracking-widest uppercase hover:bg-neutral-800 transition-colors"
              >
                Submit Round
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Fullscreen blocker modal ── */}
      <AnimatePresence>
        {!isFullscreen && !loading && !submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-50 flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center flex flex-col gap-6 items-center border border-neutral-200 shadow-2xl">
              <span className="text-5xl">💻</span>
              <h3 className="text-2xl font-extrabold tracking-tight text-black">
                Fullscreen Mode Required
              </h3>
              <p className="text-sm font-semibold leading-relaxed text-neutral-500">
                To begin or continue this round, you must enter Fullscreen mode. Exiting fullscreen or switching tabs will be flagged as a violation.
              </p>
              <button
                onClick={resumeTest}
                className="w-full py-4 bg-black rounded-xl text-white font-bold tracking-widest uppercase hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Start Round
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submit Confirm Modal ── */}
      <AnimatePresence>
        {showConfirmModal && !showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-2xl p-10 max-w-md w-full text-center flex flex-col gap-6 items-center shadow-2xl border border-neutral-200"
            >
              <h3 className="text-2xl font-extrabold tracking-tight text-black">
                Are you sure?
              </h3>
              <p className="text-sm font-semibold leading-relaxed text-neutral-500">
                Are you sure you want to final submit Round 1?<br />
                You have answered{" "}
                <strong className="text-black">{answeredCount}</strong> of{" "}
                <strong className="text-black">{questions.length}</strong> questions.
                <br /><br />
                <span className="text-red-600 font-bold">You cannot modify your answers after submission.</span>
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl text-sm font-bold tracking-widest uppercase border-2 border-neutral-200 bg-white text-black hover:border-black transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitRound(false)}
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl text-sm font-bold tracking-widest uppercase bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                      Submitting…
                    </span>
                  ) : "OK — Submit"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submission Success Screen ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-stone-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl p-10 max-w-md w-full text-center flex flex-col gap-6 items-center shadow-[0_24px_60px_rgb(0,0,0,0.12)] border border-neutral-200"
            >
              {/* Checkmark icon */}
              <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-extrabold tracking-tight text-black mb-1">
                  Round 1 Submitted Successfully
                </h3>
                <p className="text-sm font-semibold text-neutral-500">
                  Your answers have been submitted successfully.
                </p>
              </div>

              {/* Round Status Card */}
              <div className="w-full bg-stone-50 border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3 text-left">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Round Status</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-black">Status</span>
                  <span className="text-sm font-bold text-black flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Completed
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-black">Access</span>
                  <span className="text-sm font-bold text-neutral-500 flex items-center gap-2">
                    🔒 Locked
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-black">Answered</span>
                  <span className="text-sm font-bold text-black">{answeredCount} / {questions.length} questions</span>
                </div>
              </div>

              <p className="text-xs font-semibold text-neutral-400 leading-relaxed">
                Please wait while the organizers evaluate your submission.<br />
                Redirecting to waiting room…
              </p>

              {/* Progress bar for redirect countdown */}
              <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-black rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
