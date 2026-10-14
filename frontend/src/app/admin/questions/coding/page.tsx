"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
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

const DIFF_CLASSES = {
  easy:   "bg-zinc-100 text-neutral-600",
  medium: "bg-zinc-200 text-black",
  hard:   "bg-black text-white",
};

const EMPTY_FORM = {
  title: "",
  story: "",
  examples: [] as Example[],
  constraints: "",
  visibleTestCases: [] as TestCase[],
  difficulty: "medium" as "easy" | "medium" | "hard",
  order: 0,
  timeLimit: 2,
  memoryLimit: 256,
};

function AdminNav({ active }: { active: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { portalSettings } = usePortal();
  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Questions", href: "/admin/questions" },
    { label: "Participants", href: "/admin/participants" },
    { label: "Security", href: "/admin/security" },
  ];
  return (
    <header className="w-full h-16 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="flex items-center gap-4">
        <img
          src={portalSettings.collegeLogo || "/college_logo.png"}
          alt={portalSettings.collegeName || "College Logo"}
          className="w-9 h-9 object-contain rounded-xl border border-neutral-200 p-0.5 bg-white"
        />
        <div>
          <span className="font-extrabold text-base tracking-wider text-black uppercase block leading-none">{portalSettings.eventName || "Code Crackers"}</span>
          <span className="text-xs font-bold tracking-widest uppercase text-neutral-500">ADMIN CONTROL CENTER</span>
        </div>
      </div>
      <nav className="flex items-center gap-2">
        {navItems.map((item) => (
          <button key={item.href} onClick={() => router.push(item.href)}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors cursor-pointer border-2 ${active === item.href ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-transparent hover:border-neutral-200'}`}
          >{item.label}</button>
        ))}
        <div className="w-px h-5 mx-1 bg-neutral-200" />
        <button onClick={logout} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer text-neutral-400 hover:text-red-500 transition-colors">Logout</button>
      </nav>
    </header>
  );
}

export default function AdminCodingQuestionsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dynamicRounds } = usePortal();
  const selectedRoundId = searchParams.get("roundId") || "built_in_2";

  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQuestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/coding?roundId=${selectedRoundId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setQuestions(await res.json());
    } catch { showToast("Failed to connect to server.", "error"); }
    finally { setLoading(false); }
  }, [token, selectedRoundId]);

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin" && user.role !== "super_admin") { router.replace("/dashboard"); return; }
    fetchQuestions();
  }, [token, user, router, fetchQuestions]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order: questions.length + 1, examples: [{ input: "", output: "", explanation: "" }], visibleTestCases: [{ input: "", expectedOutput: "", label: "Test Case 1" }] });
    setShowForm(true);
  };

  const openEdit = (q: CodingQuestion) => {
    setEditingId(q.id);
    setForm({
      title: q.title, story: q.story,
      examples: q.examples && q.examples.length > 0 ? [...q.examples] : [{ input: "", output: "", explanation: "" }],
      constraints: q.constraints || "",
      visibleTestCases: q.visibleTestCases && q.visibleTestCases.length > 0 ? [...q.visibleTestCases] : [{ input: "", expectedOutput: "", label: "Test Case 1" }],
      difficulty: q.difficulty, order: q.order, timeLimit: q.timeLimit || 2, memoryLimit: q.memoryLimit || 256,
    });
    setShowForm(true);
  };

  const addExampleField = () => setForm((f) => ({ ...f, examples: [...f.examples, { input: "", output: "", explanation: "" }] }));
  const removeExampleField = (index: number) => setForm((f) => ({ ...f, examples: f.examples.filter((_, i) => i !== index) }));
  const handleExampleChange = (index: number, key: keyof Example, val: string) => {
    setForm((f) => { const copy = [...f.examples]; copy[index] = { ...copy[index], [key]: val }; return { ...f, examples: copy }; });
  };

  const addTestCaseField = () => setForm((f) => ({ ...f, visibleTestCases: [...f.visibleTestCases, { input: "", expectedOutput: "", label: `Test Case ${f.visibleTestCases.length + 1}` }] }));
  const removeTestCaseField = (index: number) => setForm((f) => ({ ...f, visibleTestCases: f.visibleTestCases.filter((_, i) => i !== index) }));
  const handleTestCaseChange = (index: number, key: keyof TestCase, val: string) => {
    setForm((f) => { const copy = [...f.visibleTestCases]; copy[index] = { ...copy[index], [key]: val }; return { ...f, visibleTestCases: copy }; });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { showToast("Title is required.", "error"); return; }
    if (!form.story.trim()) { showToast("Story/Description is required.", "error"); return; }
    setSubmitting(true);
    try {
      const url = editingId ? `${API_BASE}/api/admin/questions/coding/${editingId}` : `${API_BASE}/api/admin/questions/coding`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roundId: selectedRoundId }),
      });
      const data = await res.json();
      if (res.ok) { showToast(editingId ? "Coding question updated." : "Coding question created."); setShowForm(false); fetchQuestions(); }
      else showToast(data.message || "Failed.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/coding/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { showToast("Question deleted."); setDeleteConfirm(null); fetchQuestions(); }
      else showToast("Failed to delete.", "error");
    } catch { showToast("Network error.", "error"); }
  };

  const handleBulkImport = async () => {
    setBulkLoading(true);
    try {
      const qs = JSON.parse(bulkText);
      const res = await fetch(`${API_BASE}/api/admin/questions/coding/bulk-import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ questions: qs, roundId: selectedRoundId }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message); setBulkText(""); setShowBulk(false); fetchQuestions(); }
      else showToast(data.message || "Import failed.", "error");
    } catch { showToast("Invalid JSON format. Check keys and braces.", "error"); }
    finally { setBulkLoading(false); }
  };

  const filtered = questions.filter((q) => {
    const matchDiff = diffFilter === "all" || q.difficulty === diffFilter;
    const matchSearch = !searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.story.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDiff && matchSearch;
  });

  const roundsList = dynamicRounds.length > 0 ? dynamicRounds : [
    { id: "built_in_1", name: "Round 1: MCQs", type: "mcq" },
    { id: "built_in_2", name: "Round 2: Coding", type: "coding" },
    { id: "built_in_3", name: "Round 3: Bug Hunter", type: "bug_hunter" },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl border-2 ${toast.type === "success" ? "bg-white border-black text-black" : "bg-white border-red-500 text-red-600"}`}
          >
            {toast.type === "success" ? "✓" : "✕"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AdminNav active="/admin/questions" />

      {/* Subtabs */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-12 mt-4 sm:mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-200 pb-2 sm:pb-0 gap-3">
        <div className="flex gap-1 overflow-x-auto max-w-full pb-1">
          {roundsList.map((r) => {
            const isActive = selectedRoundId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  if (r.type === "mcq" || r.type === "rapid_fire" || r.type === "aptitude") {
                    router.push(`/admin/questions?roundId=${r.id}`);
                  } else if (r.type === "bug_hunter") {
                    router.push(`/admin/questions/debug?roundId=${r.id}`);
                  } else {
                    router.push(`/admin/questions/coding?roundId=${r.id}`);
                  }
                }}
                className={`px-5 py-3 text-xs font-bold tracking-wider uppercase cursor-pointer border-b-2 transition-colors whitespace-nowrap ${isActive ? 'border-black text-black font-extrabold' : 'border-transparent text-neutral-400 hover:text-black'}`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 pb-3">
          <button onClick={() => setShowBulk(true)} className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors">
            Bulk Import
          </button>
          <button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors">
            + Add Coding Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-12 py-4 sm:py-6 flex items-center gap-4 flex-wrap">
        <input type="text" placeholder="Search by title or content…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-5 py-3 rounded-xl text-sm font-semibold bg-white border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black transition-colors"
        />
        {(["all", "easy", "medium", "hard"] as const).map((d) => (
          <button key={d} onClick={() => setDiffFilter(d)}
            className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors ${diffFilter === d ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:border-black'}`}
          >{d === "all" ? "All" : d}</button>
        ))}
      </div>

      {/* Question list */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-12 pb-12">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl opacity-20">💻</div>
            <p className="text-xl font-extrabold text-neutral-400 tracking-tight">
              {questions.length === 0 ? "No coding questions yet. Add some!" : "No results match your filter."}
            </p>
            {questions.length === 0 && (
              <button onClick={openCreate} className="mt-2 px-8 py-4 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors">
                + Add First Coding Question
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((q, idx) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.02 }}
                className="rounded-2xl p-6 flex flex-col md:flex-row md:items-start gap-5 bg-white border-2 border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
              >
                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-extrabold text-sm bg-zinc-100 text-black">
                  {q.order}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-extrabold text-black mb-2">{q.title}</h3>
                  <p className="text-xs font-semibold text-neutral-500 line-clamp-2 mb-3 leading-relaxed">{q.story}</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-neutral-400">
                    <span>⏱ {q.timeLimit}s</span>
                    <span>📦 {q.memoryLimit}MB</span>
                    <span>{q.visibleTestCases ? q.visibleTestCases.length : 0} test cases</span>
                  </div>
                </div>
                <div className="flex md:flex-col items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${DIFF_CLASSES[q.difficulty]}`}>{q.difficulty}</span>
                  <button onClick={() => openEdit(q)} className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-neutral-200 bg-white text-black hover:border-black transition-colors">Edit</button>
                  {deleteConfirm === q.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(q.id)} className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer bg-red-600 text-white border-2 border-red-600 hover:bg-red-700 transition-colors">Confirm</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(q.id)} className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-red-100 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Delete</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-4xl rounded-3xl p-8 md:p-10 flex flex-col gap-6 max-h-[90vh] overflow-y-auto bg-white border border-neutral-200 shadow-2xl"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-black">{editingId ? "Edit Coding Question" : "New Coding Question"}</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">Write the narrative, provide test cases and examples for participants.</p>
              </div>

              {/* Title & Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Question Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Enter question title..."
                    className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors placeholder-neutral-400"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Difficulty</label>
                  <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as "easy" | "medium" | "hard" }))}
                    className="px-5 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Story */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Story / Narrative Description *</label>
                <textarea value={form.story} onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))} rows={4} placeholder="Describe the programming problem in a narrative..."
                  className="w-full px-5 py-4 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
                />
              </div>

              {/* Constraints */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Constraints</label>
                <input type="text" value={form.constraints} onChange={(e) => setForm((f) => ({ ...f, constraints: e.target.value }))} placeholder="Example: 1 <= N <= 10^5"
                  className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors placeholder-neutral-400"
                />
              </div>

              {/* Examples */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Examples (shown in problem description)</label>
                  <button type="button" onClick={addExampleField} className="text-xs font-bold text-black cursor-pointer hover:underline">+ Add Example</button>
                </div>
                {form.examples.map((ex, i) => (
                  <div key={i} className="rounded-2xl p-4 bg-zinc-50 border-2 border-neutral-200 flex flex-col gap-3 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-bold text-neutral-400 block mb-1.5">Example Input</span>
                        <input type="text" value={ex.input} onChange={(e) => handleExampleChange(i, "input", e.target.value)} placeholder="Input value..."
                          className="w-full px-4 py-2.5 rounded-xl text-xs font-mono text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-neutral-400 block mb-1.5">Example Output</span>
                        <input type="text" value={ex.output} onChange={(e) => handleExampleChange(i, "output", e.target.value)} placeholder="Output value..."
                          className="w-full px-4 py-2.5 rounded-xl text-xs font-mono text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-400 block mb-1.5">Explanation (Optional)</span>
                      <input type="text" value={ex.explanation || ""} onChange={(e) => handleExampleChange(i, "explanation", e.target.value)} placeholder="Why is this the output?"
                        className="w-full px-4 py-2.5 rounded-xl text-xs text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black"
                      />
                    </div>
                    {form.examples.length > 1 && (
                      <button type="button" onClick={() => removeExampleField(i)} className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer">Delete</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Cases */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Test Cases (used for running code)</label>
                  <button type="button" onClick={addTestCaseField} className="text-xs font-bold text-black cursor-pointer hover:underline">+ Add Test Case</button>
                </div>
                {form.visibleTestCases.map((tc, i) => (
                  <div key={i} className="rounded-2xl p-4 bg-zinc-50 border-2 border-neutral-200 grid grid-cols-1 md:grid-cols-3 gap-3 relative">
                    <div>
                      <span className="text-xs font-bold text-neutral-400 block mb-1.5">Test Input</span>
                      <textarea value={tc.input} onChange={(e) => handleTestCaseChange(i, "input", e.target.value)} rows={2} placeholder="Stdin input..."
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-mono text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-bold text-neutral-400">Expected Output</span>
                        {form.visibleTestCases.length > 1 && (
                          <button type="button" onClick={() => removeTestCaseField(i)} className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer">Delete</button>
                        )}
                      </div>
                      <textarea value={tc.expectedOutput} onChange={(e) => handleTestCaseChange(i, "expectedOutput", e.target.value)} rows={2} placeholder="Stdout output..."
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-mono text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Limits and Order */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Order #", key: "order" as const, value: form.order },
                  { label: "Time Limit (sec)", key: "timeLimit" as const, value: form.timeLimit },
                  { label: "Memory Limit (MB)", key: "memoryLimit" as const, value: form.memoryLimit },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">{item.label}</label>
                    <input type="number" value={item.value} onChange={(e) => setForm((f) => ({ ...f, [item.key]: Number(e.target.value) }))}
                      className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black text-center"
                    />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  {submitting ? "Saving…" : editingId ? "Save Changes" : "Create Question"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {showBulk && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowBulk(false); }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl rounded-3xl p-10 flex flex-col gap-6 bg-white border border-neutral-200 shadow-2xl"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-black">Bulk Import Coding Questions</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">Paste a JSON array of coding question objects.</p>
              </div>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} placeholder="Paste JSON array here…"
                className="w-full px-5 py-4 rounded-xl text-xs font-mono text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowBulk(false)} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors">Cancel</button>
                <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  {bulkLoading ? "Importing…" : "Import Questions"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
