"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import CountdownOverlay from "@/components/CountdownOverlay";
import { usePortal } from "@/lib/portalContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface TestCase {
  input: string;
  expectedOutput: string;
  label?: string;
}

interface Example {
  input: string;
  output: string;
  explanation?: string;
}

interface CodingQuestion {
  id: string;
  title: string;
  story: string;
  examples: Example[];
  constraints: string;
  visibleTestCases: TestCase[];
  difficulty: "easy" | "medium" | "hard";
  order: number;
  timeLimit: number;
  memoryLimit: number;
}

interface SavedCode {
  code: string;
  language: string;
  lastSaved: string | null;
  isSubmitted: boolean;
}

interface CodeSubmission {
  status: "in_progress" | "submitted";
  answerData: Record<string, SavedCode>;
}

const STARTER_TEMPLATES: Record<string, string> = {
  java: `public class Main {
    public static void main(String[] args) {

    }
}`,

  c: `#include <stdio.h>

int main() {

    return 0;
}`,

  cpp: `#include <iostream>
using namespace std;

int main() {

    return 0;
}`,

  python: `def main():
    pass

if __name__ == "__main__":
    main()`,

  javascript: `function main() {

}

main();`,
};

export default function Round2CodingPage() {
  const { token, user, isLoading: authLoading, logout } = useAuth();
  const { portalSettings, dynamicRounds } = usePortal();
  const router = useRouter();

  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("00:00");
  const [loading, setLoading] = useState(true);
  
  // Code editor states
  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<string>("javascript");
  const [savedCodes, setSavedCodes] = useState<Record<string, SavedCode>>({});
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"in_progress" | "submitted">("in_progress");
  const [countdownStartedAt, setCountdownStartedAt] = useState<string | null>(null);
  const [roundStartedAt, setRoundStartedAt]         = useState<string | null>(null);
  const [countdownDone, setCountdownDone]           = useState(false);

  // Console states
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<any[] | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | "saving" | "error">("saved");

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

  const [showFullscreenExitModal, setShowFullscreenExitModal] = useState(false);

  const logViolation = useCallback((type: string, details?: string) => {
    if (!token) return;
    fetch(`${API_BASE}/api/competition/violation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type, round: 2, details }),
    }).catch(() => {});
  }, [token]);

  const handleTabSwitch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/round2/tab-switch`, {
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

  const handleFullscreenExit = useCallback(async () => {
    if (submissionStatus === "submitted" || loading) return;
    logViolation("FULLSCREEN_EXIT", "Participant exited fullscreen mode during Round 2");
    setShowFullscreenExitModal(true);
    try {
      await handleFinalSubmit(true);
    } catch {}
    setTimeout(() => {
      logout();
    }, 5000);
  }, [submissionStatus, loading, logViolation, logout]);

  const { enterFullscreen } = useAntiCheat({
    disablePaste: true,
    disableRightClick: true,
    onTabSwitch: handleTabSwitch,
    onFullscreenExit: handleFullscreenExit,
    onViolation: logViolation,
  });

  const resumeTest = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch coding questions and state
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/round2/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          router.replace("/dashboard");
        }
        return;
      }
      const data = await res.json();
      setQuestions(data.questions);
      setEndsAt(data.endsAt);

      // Server-synced countdown fields
      setCountdownStartedAt(data.countdownStartedAt || null);
      setRoundStartedAt(data.roundStartedAt || null);

      const roundStart = data.roundStartedAt ? new Date(data.roundStartedAt).getTime() : 0;
      if (!data.countdownStartedAt || Date.now() >= roundStart) {
        setCountdownDone(true);
      }

      if (data.submission) {
        setSubmissionStatus(data.submission.status);
        setSavedCodes(data.submission.answerData || {});
        setTabSwitchCount(data.submission.tabSwitchCount || 0);
        if (data.submission.status === "submitted") {
          router.replace("/dashboard/waiting-evaluation?round=2");
          return;
        }
      }
    } catch {
      // Keep loading
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

  // Handle active question change
  useEffect(() => {
    if (questions.length === 0) return;
    const activeQ = questions[activeIdx];
    const saved = savedCodes[activeQ.id];

    if (saved) {
      setCode(saved.code);
      setLanguage(saved.language);
    } else {
      setLanguage("javascript");
      setCode(STARTER_TEMPLATES["javascript"]);
    }
  }, [activeIdx, questions, savedCodes]);

  // Handle Timer Countdown
  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        // Auto submit
        handleFinalSubmit(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  // Autosave logic (debounce)
  const triggerAutosave = useCallback(
    (newCode: string, lang: string) => {
      if (submissionStatus === "submitted" || questions.length === 0) return;
      setAutosaveStatus("saving");

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        const activeQ = questions[activeIdx];
        try {
          const res = await fetch(`${API_BASE}/api/round2/save`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ questionId: activeQ.id, code: newCode, language: lang }),
          });
          if (res.ok) {
            setAutosaveStatus("saved");
            // Update local save cache
            setSavedCodes((prev) => ({
              ...prev,
              [activeQ.id]: {
                code: newCode,
                language: lang,
                lastSaved: new Date().toISOString(),
                isSubmitted: false,
              },
            }));
          } else {
            setAutosaveStatus("error");
          }
        } catch {
          setAutosaveStatus("error");
        }
      }, 1000); // 1s debounce
    },
    [token, activeIdx, questions, submissionStatus]
  );

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    // If no custom code saved yet, prefill template
    const activeQ = questions[activeIdx];
    if (!savedCodes[activeQ.id] || savedCodes[activeQ.id].language !== lang) {
      const template = STARTER_TEMPLATES[lang] || "";
      setCode(template);
      triggerAutosave(template, lang);
    } else {
      triggerAutosave(code, lang);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    const val = value || "";
    setCode(val);
    triggerAutosave(val, language);
  };

  // Run Code against Visible Test Cases
  const handleRunCode = async () => {
    if (questions.length === 0) return;
    setIsRunning(true);
    setConsoleOpen(true);
    setRunResults(null);

    const activeQ = questions[activeIdx];
    try {
      const res = await fetch(`${API_BASE}/api/round2/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: activeQ.id,
          code,
          language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRunResults(data.results || []);
      } else {
        setRunResults([{ error: "Server failed to run code." }]);
      }
    } catch {
      setRunResults([{ error: "Network error running code." }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = async (auto = false) => {
    if (submissionStatus === "submitted") return;
    if (!auto && !confirm("Are you sure you want to final submit Round 2? You cannot modify code after this.")) {
      return;
    }

    setIsSubmittingRound(true);
    try {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      const res = await fetch(`${API_BASE}/api/round2/submit`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
      });
      if (res.ok) {
        setSubmissionStatus("submitted");
        window.location.href = "/dashboard/waiting-evaluation?round=2";
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.message && errData.message.toLowerCase().includes("already submitted")) {
          window.location.href = "/dashboard/waiting-evaluation?round=2";
          return;
        }
        alert(errData.message || "Failed to submit Round 2.");
        setIsSubmittingRound(false);
      }
    } catch (err) {
      console.error("Submit Round 2 error:", err);
      window.location.href = "/dashboard/waiting-evaluation?round=2";
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

  return (
    <div className="min-h-screen bg-[#06040A] text-white flex flex-col font-sans overflow-hidden">
      {!countdownDone && !loading && (
        <CountdownOverlay
          countdownStartedAt={countdownStartedAt}
          roundStartedAt={roundStartedAt}
          roundName="Round 2 — Coding"
          message="Get ready! Your coding round is about to start. Good luck!"
          onComplete={() => setCountdownDone(true)}
        />
      )}
      
      {/* Top Navigation / Status Header */}
      <header className="w-full h-auto min-h-[56px] px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 bg-white border-b border-neutral-200 flex-wrap gap-2 text-black">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src={portalSettings.collegeLogo || "/college_logo.png"}
              alt={portalSettings.collegeName || "College Logo"}
              className="w-7 h-7 object-contain rounded border border-neutral-200 p-0.5 bg-white"
            />
            <span className="font-extrabold text-sm tracking-widest text-black uppercase">
              {dynamicRounds.find((r) => r.type === "coding" || r.order === 2)?.name || "ROUND 02: STORY CODING"}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-[150px] sm:max-w-none">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setActiveIdx(idx)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-2 ${
                  activeIdx === idx
                    ? "bg-black border-black text-white"
                    : "bg-white border-transparent text-neutral-500 hover:border-neutral-200"
                }`}
              >
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Autosave status badge */}
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

      {/* Main split view container */}
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Left story panel */}
        <section className="w-full md:w-1/2 p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 sm:gap-6 bg-stone-50 border-b md:border-b-0 md:border-r border-neutral-200 max-h-[45vh] md:max-h-none">
          {activeQuestion && (
            <>
              <div>
                <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                  QUESTION {activeIdx + 1} ({activeQuestion.difficulty})
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-black mt-2 leading-tight">
                  {activeQuestion.title}
                </h1>
              </div>

              {/* Story body */}
              <div className="rounded-2xl p-6 bg-white border border-neutral-200 text-sm leading-relaxed text-neutral-700 whitespace-pre-line shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                {activeQuestion.story}
              </div>

              {/* Constraints */}
              {activeQuestion.constraints && (
                <div>
                  <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-500 mb-3">
                    Constraints
                  </h3>
                  <div className="rounded-xl px-5 py-3 bg-zinc-100 border border-neutral-200 font-mono text-xs text-black">
                    {activeQuestion.constraints}
                  </div>
                </div>
              )}

              {/* Examples */}
              {activeQuestion.examples && activeQuestion.examples.length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-500">
                    Examples
                  </h3>
                  {activeQuestion.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-5 bg-white border border-neutral-200 flex flex-col gap-3 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
                    >
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1">Input</span>
                          <span className="text-black bg-zinc-100 px-3 py-2 rounded-lg block overflow-x-auto whitespace-pre border border-neutral-200">
                            {ex.input}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1">Output</span>
                          <span className="text-black bg-zinc-100 px-3 py-2 rounded-lg block overflow-x-auto whitespace-pre border border-neutral-200">
                            {ex.output}
                          </span>
                        </div>
                      </div>
                      {ex.explanation && (
                        <p className="text-xs text-neutral-600 italic mt-2">
                          💡 {ex.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Right editor panel */}
        <section className="w-full md:w-1/2 flex flex-col relative bg-[#1e1e1e] min-h-[400px] md:min-h-0 flex-1">
          {/* Language selection toolbar */}
          <div className="h-auto min-h-[48px] py-2 border-b border-[#333333] px-3 sm:px-6 flex items-center justify-between bg-[#1e1e1e] flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Language:</span>
              <select
                value={language}
                disabled={submissionStatus === "submitted"}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-[#2d2d2d] border border-[#404040] rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-white cursor-pointer"
              >
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="python">Python 3</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="java">Java</option>
              </select>
            </div>

            <button
              onClick={handleRunCode}
              disabled={isRunning || submissionStatus === "submitted"}
              className="px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer transition-colors border-2 border-[#404040] bg-[#2d2d2d] text-white hover:border-white disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Run Code"}
            </button>
          </div>

          {/* Monaco Editor */}
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
              language={language === "cpp" ? "cpp" : language === "java" ? "java" : language === "python" ? "python" : "javascript"}
              value={code}
              options={{
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                minimap: { enabled: false },
                readOnly: submissionStatus === "submitted",
              }}
              onChange={handleEditorChange}
            />
          </div>

          {/* Test results console drawer */}
          <AnimatePresence>
            {consoleOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "45%" }}
                exit={{ height: 0 }}
                className="absolute bottom-0 left-0 right-0 z-30 border-t border-[#333333] flex flex-col bg-[#1e1e1e]"
              >
                {/* Console header */}
                <div className="h-12 border-b border-[#333333] px-6 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Console Output</span>
                  <button
                    onClick={() => setConsoleOpen(false)}
                    className="text-neutral-400 hover:text-white cursor-pointer text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Console output body */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-white">
                  {isRunning ? (
                    <div className="flex flex-col gap-4 items-center justify-center h-full text-neutral-400">
                      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-white" />
                      <span className="font-bold tracking-widest uppercase">Executing test cases...</span>
                    </div>
                  ) : runResults ? (
                    <div className="flex flex-col gap-5">
                      {runResults.map((res: any, i: number) => (
                        <div
                          key={i}
                          className={`rounded-xl p-5 border-2 ${
                            res.passed
                              ? "bg-green-950/20 border-green-500/30 text-green-400"
                              : "bg-red-950/20 border-red-500/30 text-red-400"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between text-sm mb-3">
                            <span>
                              {res.passed ? "✓ TEST CASE PASSED" : "✕ TEST CASE FAILED"}
                            </span>
                            {res.timeMs !== undefined && (
                              <span className="text-neutral-400 text-xs">
                                Time: {res.timeMs}ms
                              </span>
                            )}
                          </div>

                          {res.error && (
                            <div className="text-red-400 mt-2 whitespace-pre-wrap text-xs bg-red-950/40 p-3 rounded-lg border border-red-900/50">
                              {res.error}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-xs font-mono text-neutral-300 mt-2">
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1.5">Input</span>
                              <pre className="bg-[#2d2d2d] p-3 rounded-lg overflow-x-auto whitespace-pre border border-[#404040]">
                                {res.input}
                              </pre>
                            </div>
                            <div>
                              <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1.5">
                                Expected Output
                              </span>
                              <pre className="bg-[#2d2d2d] p-3 rounded-lg overflow-x-auto whitespace-pre border border-[#404040]">
                                {res.expectedOutput}
                              </pre>
                            </div>
                          </div>

                          {!res.passed && !res.error && (
                            <div className="mt-3 text-xs">
                              <span className="text-neutral-500 block text-[10px] uppercase font-bold mb-1.5">
                                Actual Output
                              </span>
                              <pre className="bg-red-950/30 p-3 rounded-lg overflow-x-auto whitespace-pre text-red-300 border border-red-900/50">
                                {res.actualOutput}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-neutral-500 font-bold tracking-widest uppercase">
                      Click "Run Code" to evaluate your solution.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* ── Fullscreen Exit Violation Modal ── */}
      <AnimatePresence>
        {showFullscreenExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-neutral-900 border-2 border-red-500 rounded-3xl p-8 md:p-12 max-w-lg w-full text-center flex flex-col gap-6 items-center shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/40 flex items-center justify-center text-3xl font-extrabold">
                ⚠
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                Full Screen Mode Was Exited
              </h2>
              <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-5 text-left text-xs space-y-2 text-red-200 font-medium leading-relaxed w-full">
                <p className="font-bold text-white text-sm">
                  As per the competition rules, your submission has been automatically submitted.
                </p>
                <p>
                  <strong className="text-red-400">Reason:</strong> Full Screen Exit
                </p>
                <p className="text-neutral-400 text-[11px] pt-2">
                  Please contact the event organizers if you believe this occurred in error. Logging out in 5 seconds...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen blocker modal ── */}
      <AnimatePresence>
        {!isFullscreen && !loading && submissionStatus !== "submitted" && !showFullscreenExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-stone-50 flex items-center justify-center p-6"
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
    </div>
  );
}
