"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Code2, Bug, ClipboardList } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Round 1 types ─────────────────────────────────────────────────────────
interface QuestionDetailR1 {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  studentAnswer: number | null;
  marksAwarded: number;
}

// ─── Round 2 types ─────────────────────────────────────────────────────────
interface QuestionDetailR2 {
  id: string;
  title: string;
  difficulty: string;
  points: number;
  submittedCode: string;
  language: string;
  isSubmitted: boolean;
  lastSaved: string | null;
}

// ─── Round 3 types ─────────────────────────────────────────────────────────
interface QuestionDetailR3 {
  id: string;
  title: string;
  difficulty: string;
  points: number;
  pointsEarned: number;
  submittedCode: string;
  language: string;
  isCorrect: boolean;
  lastSaved: string | null;
}

interface SubmissionDetails {
  fullName: string;
  username: string;
  department: string;
  roundName: string;
  submissionTime: string | null;
  timeTaken: string;
  totalScore: number;
  // round 1 only
  questions?: QuestionDetailR1[];
  // round 2 only
  codingQuestions?: QuestionDetailR2[];
  // round 3 only
  debugQuestions?: QuestionDetailR3[];
}

function DiffBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, string> = {
    easy: "bg-zinc-100 text-neutral-600",
    medium: "bg-zinc-200 text-black",
    hard: "bg-black text-white",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${map[difficulty] || "bg-zinc-100 text-neutral-600"}`}>
      {difficulty}
    </span>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border-2 border-neutral-800">
      <div className="flex items-center justify-between bg-neutral-900 px-4 py-2">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{language}</span>
        <Code2 size={12} className="text-neutral-500" />
      </div>
      <pre className="bg-[#040114] text-zinc-200 text-xs leading-relaxed overflow-x-auto p-4 max-h-72 font-mono whitespace-pre-wrap">
        {code || "(No code submitted)"}
      </pre>
    </div>
  );
}

function SubmissionInner({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const round = parseInt(searchParams.get("round") || "1", 10);
  const { user: adminUser, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [details, setDetails] = useState<SubmissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return; // wait for localStorage rehydration
    if (!token) {
      router.replace("/login");
      return;
    }
    if (adminUser && adminUser.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `${API_BASE}/api/admin/participants/${userId}/submission/round${round}`;
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Normalize question arrays per round
          if (round === 1) {
            setDetails({ ...data, questions: data.questions });
          } else if (round === 2) {
            setDetails({ ...data, codingQuestions: data.questions });
          } else if (round === 3) {
            setDetails({ ...data, debugQuestions: data.questions });
          } else {
            setDetails(data);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.message || `Failed to load Round ${round} submission details.`);
        }
      } catch {
        setError("Error connecting to server.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [authLoading, token, adminUser, router, userId, round]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 text-black p-6">
        <div className="bg-white border-2 border-neutral-200 rounded-3xl p-8 max-w-md w-full text-center flex flex-col gap-6 items-center shadow-lg">
          <XCircle className="text-red-500 w-12 h-12" />
          <h2 className="text-xl font-extrabold">No Submission Found</h2>
          <p className="text-sm font-semibold text-neutral-500">{error || "No data available."}</p>
          <button
            onClick={() => window.close()}
            className="w-full py-3 bg-black text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  const roundIcon = round === 1 ? <ClipboardList size={16} /> : round === 2 ? <Code2 size={16} /> : <Bug size={16} />;

  return (
    <div className="min-h-screen bg-stone-50 text-black flex flex-col">
      {/* Header */}
      <header className="w-full h-16 bg-white px-6 md:px-12 flex items-center gap-4 sticky top-0 z-50 border-b border-neutral-200 shadow-sm">
        <button
          onClick={() => window.close()}
          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">{roundIcon}</span>
          <div>
            <span className="font-extrabold text-base tracking-wider text-black uppercase block leading-none">
              Submission Details
            </span>
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">
              {details.roundName}
            </span>
          </div>
        </div>

        {/* Round switcher */}
        <div className="ml-auto flex items-center gap-2">
          {[1, 2, 3].map((r) => (
            <a
              key={r}
              href={`/admin/participants/submission/${userId}?round=${r}`}
              className={`text-xs font-bold px-4 py-2 rounded-xl border-2 transition-colors ${
                round === r
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-black"
              }`}
            >
              R{r}
            </a>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8 flex-1">

        {/* Profile Card */}
        <div className="bg-white border-2 border-neutral-200 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">Participant</span>
            <h2 className="text-2xl font-extrabold text-black leading-none">{details.fullName}</h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mt-1">
              <span>@{details.username}</span>
              <span>•</span>
              <span>{details.department}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-bold text-sm">
            <div className="flex flex-col gap-1 bg-stone-50 border border-neutral-100 p-4 rounded-2xl min-w-[110px]">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest">Time Taken</span>
              <span className="text-base text-black">{details.timeTaken}</span>
            </div>
            <div className="flex flex-col gap-1 bg-stone-50 border border-neutral-100 p-4 rounded-2xl min-w-[110px]">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest">Submitted At</span>
              <span className="text-base text-black">
                {details.submissionTime
                  ? new Date(details.submissionTime).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "N/A"}
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-black text-white p-4 rounded-2xl min-w-[110px] col-span-2 md:col-span-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Score Awarded</span>
              <span className="text-lg text-white font-extrabold">{details.totalScore} pts</span>
            </div>
          </div>
        </div>

        {/* ── ROUND 1: MCQ questions ─────────────────────────────────────────── */}
        {round === 1 && details.questions && (
          <div className="flex flex-col gap-6">
            <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-500 px-1">
              Questions &amp; Answers ({details.questions.length} MCQs)
            </h3>
            {details.questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white border-2 border-neutral-200 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <span className="text-xs font-bold px-3.5 py-1.5 bg-zinc-100 rounded-full text-black">
                    Question {qIdx + 1}
                  </span>
                  <span
                    className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                      q.marksAwarded > 0 ? "bg-black text-white" : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {q.marksAwarded > 0 ? (
                      <><CheckCircle2 size={12} /> Correct (+{q.marksAwarded})</>
                    ) : (
                      <><XCircle size={12} /> Incorrect (+0)</>
                    )}
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-black leading-tight">{q.questionText}</h4>
                <div className="grid grid-cols-1 gap-3">
                  {q.options.map((optText, optIdx) => {
                    const isSelected = q.studentAnswer === optIdx;
                    const isCorrect = q.correctAnswer === optIdx;
                    let borderClass = "border-neutral-200";
                    let bgClass = "bg-white";
                    let indicator = "○";
                    if (isCorrect) {
                      borderClass = "border-black bg-zinc-100";
                      indicator = "✅";
                    } else if (isSelected) {
                      borderClass = "border-red-500";
                      bgClass = "bg-red-50/50";
                      indicator = "❌";
                    }
                    return (
                      <div key={optIdx} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${borderClass} ${bgClass}`}>
                        <span className="text-sm font-semibold">{indicator}</span>
                        <span className="text-sm font-bold text-black">
                          {optText}
                          {isSelected && <span className="text-neutral-400 font-semibold text-xs ml-2">(Participant Selected)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-stone-50 border border-neutral-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-neutral-500">
                  <span>Correct Option: <strong className="text-black uppercase">{String.fromCharCode(65 + q.correctAnswer)}</strong></span>
                  <span>Marks Awarded: <strong className="text-black">{q.marksAwarded}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ROUND 2: Coding submissions ─────────────────────────────────────── */}
        {round === 2 && details.codingQuestions && (
          <div className="flex flex-col gap-6">
            <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-500 px-1">
              Coding Submissions ({details.codingQuestions.length} Problems)
            </h3>
            {details.codingQuestions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white border-2 border-neutral-200 rounded-3xl p-6 md:p-8 flex flex-col gap-5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-3.5 py-1.5 bg-zinc-100 rounded-full text-black">
                      Problem {qIdx + 1}
                    </span>
                    <DiffBadge difficulty={q.difficulty} />
                  </div>
                  <span className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                    q.isSubmitted ? "bg-black text-white" : "bg-zinc-100 text-neutral-500 border border-neutral-200"
                  }`}>
                    {q.isSubmitted ? <><CheckCircle2 size={12} /> Submitted (+{q.points} pts)</> : <><XCircle size={12} /> Not Submitted</>}
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-black leading-tight">{q.title}</h4>
                <div className="flex items-center gap-3 text-xs font-bold text-neutral-500">
                  <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">Lang: <strong className="text-black uppercase">{q.language}</strong></span>
                  {q.lastSaved && (
                    <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">
                      Last saved: <strong className="text-black">{new Date(q.lastSaved).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</strong>
                    </span>
                  )}
                </div>
                <CodeBlock code={q.submittedCode} language={q.language} />
              </div>
            ))}
          </div>
        )}

        {/* ── ROUND 3: Bug Hunter submissions ────────────────────────────────── */}
        {round === 3 && details.debugQuestions && (
          <div className="flex flex-col gap-6">
            <h3 className="text-xs font-bold tracking-widest uppercase text-neutral-500 px-1">
              Bug Hunter Submissions ({details.debugQuestions.length} Challenges)
            </h3>
            {details.debugQuestions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white border-2 border-neutral-200 rounded-3xl p-6 md:p-8 flex flex-col gap-5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-3.5 py-1.5 bg-zinc-100 rounded-full text-black">
                      Challenge {qIdx + 1}
                    </span>
                    <DiffBadge difficulty={q.difficulty} />
                  </div>
                  <span className={`text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                    q.isCorrect ? "bg-black text-white" : "bg-red-50 text-red-600 border border-red-200"
                  }`}>
                    {q.isCorrect
                      ? <><CheckCircle2 size={12} /> Fixed (+{q.pointsEarned} pts)</>
                      : <><XCircle size={12} /> Not Fixed (+0)</>}
                  </span>
                </div>
                <h4 className="text-lg font-extrabold text-black leading-tight">{q.title}</h4>
                <div className="flex items-center gap-3 text-xs font-bold text-neutral-500">
                  <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">Lang: <strong className="text-black uppercase">{q.language}</strong></span>
                  <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">Max: <strong className="text-black">{q.points} pts</strong></span>
                  <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">Earned: <strong className="text-black">{q.pointsEarned} pts</strong></span>
                  {q.lastSaved && (
                    <span className="bg-stone-50 border border-neutral-100 px-3 py-1.5 rounded-full">
                      Last saved: <strong className="text-black">{new Date(q.lastSaved).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</strong>
                    </span>
                  )}
                </div>
                <CodeBlock code={q.submittedCode} language={q.language} />
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

// ── Params wrapper ──────────────────────────────────────────────────────────
export default function SubmissionPage({ params }: { params: Promise<{ userId: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    }>
      <SubmissionInner userId={resolvedParams.userId} />
    </Suspense>
  );
}
