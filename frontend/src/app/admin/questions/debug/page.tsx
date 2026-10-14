"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { usePortal } from "@/lib/portalContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface DebugQuestion {
  id: string;
  title: string;
  description: string;
  buggyCode: string;
  fixedCode: string;
  language: string;
  hints: string[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

const DIFF_CLASSES = {
  easy:   "bg-zinc-100 text-neutral-600",
  medium: "bg-zinc-200 text-black",
  hard:   "bg-black text-white",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  buggyCode: "",
  fixedCode: "",
  language: "javascript",
  hints: [] as string[],
  points: 10,
  difficulty: "medium" as "easy" | "medium" | "hard",
  order: 0,
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

export default function AdminDebugQuestionsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dynamicRounds } = usePortal();
  const selectedRoundId = searchParams.get("roundId") || "built_in_3";

  const [questions, setQuestions] = useState<DebugQuestion[]>([]);
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
      const res = await fetch(`${API_BASE}/api/admin/questions/debug?roundId=${selectedRoundId}`, { headers: { Authorization: `Bearer ${token}` } });
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
    setForm({ ...EMPTY_FORM, order: questions.length + 1, hints: [""] });
    setShowForm(true);
  };

  const openEdit = (q: DebugQuestion) => {
    setEditingId(q.id);
    setForm({
      title: q.title, description: q.description || "", buggyCode: q.buggyCode, fixedCode: q.fixedCode,
      language: q.language || "javascript", hints: q.hints && q.hints.length > 0 ? [...q.hints] : [""],
      difficulty: q.difficulty, order: q.order, points: q.points ?? 10,
    });
    setShowForm(true);
  };

  const addHintField = () => setForm((f) => ({ ...f, hints: [...f.hints, ""] }));
  const removeHintField = (index: number) => setForm((f) => ({ ...f, hints: f.hints.filter((_, i) => i !== index) }));
  const handleHintChange = (index: number, val: string) => {
    setForm((f) => { const copy = [...f.hints]; copy[index] = val; return { ...f, hints: copy }; });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { showToast("Question title is required.", "error"); return; }
    if (!form.buggyCode.trim()) { showToast("Buggy code is required.", "error"); return; }
    if (!form.fixedCode.trim()) { showToast("Fixed reference code is required.", "error"); return; }
    const validHints = form.hints.filter(h => h.trim() !== "");
    setSubmitting(true);
    try {
      const url = editingId ? `${API_BASE}/api/admin/questions/debug/${editingId}` : `${API_BASE}/api/admin/questions/debug`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hints: validHints, roundId: selectedRoundId }),
      });
      const data = await res.json();
      if (res.ok) { showToast(editingId ? "Debug question updated." : "Debug question created."); setShowForm(false); fetchQuestions(); }
      else showToast(data.message || "Failed to save.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/debug/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast("Debug question deleted."); setDeleteConfirm(null); fetchQuestions(); }
      else showToast("Failed to delete question.", "error");
    } catch { showToast("Network error.", "error"); }
  };

  const handleBulkImport = async () => {
    setBulkLoading(true);
    try {
      const parsed = JSON.parse(bulkText);
      const res = await fetch(`${API_BASE}/api/admin/questions/debug/bulk-import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ questions: parsed, roundId: selectedRoundId }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message); setBulkText(""); setShowBulk(false); fetchQuestions(); }
      else showToast(data.message || "Import failed.", "error");
    } catch { showToast("Invalid JSON format. Check keys and braces.", "error"); }
    finally { setBulkLoading(false); }
  };

  const filtered = questions.filter((q) => {
    const matchDiff = diffFilter === "all" || q.difficulty === diffFilter;
    const matchSearch = !searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.description.toLowerCase().includes(searchQuery.toLowerCase());
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
                  } else if (r.type === "coding") {
                    router.push(`/admin/questions/coding?roundId=${r.id}`);
                  } else {
                    router.push(`/admin/questions/debug?roundId=${r.id}`);
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
            + Add Bug Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-12 py-4 sm:py-6 flex items-center gap-4 flex-wrap">
        <input type="text" placeholder="Search bug hunter questions…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-5 py-3 rounded-xl text-sm font-semibold bg-white border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black transition-colors"
        />
        {(["all", "easy", "medium", "hard"] as const).map((d) => (
          <button key={d} onClick={() => setDiffFilter(d)}
            className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors ${diffFilter === d ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:border-black'}`}
          >{d === "all" ? "All" : d}</button>
        ))}
      </div>

      {/* Question list */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-12 pb-12">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl opacity-20">🐛</div>
            <p className="text-xl font-extrabold text-neutral-400 tracking-tight">
              {questions.length === 0 ? "No bug hunter questions yet. Add some!" : "No results match your filter."}
            </p>
            {questions.length === 0 && (
              <button onClick={openCreate} className="mt-2 px-8 py-4 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors">
                + Add First Bug Hunter Question
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
                  <p className="text-xs font-semibold text-neutral-500 line-clamp-2 mb-3 leading-relaxed">{q.description}</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-neutral-400">
                    <span>Language: {q.language}</span>
                    <span>Points: {q.points}</span>
                    <span>{q.hints ? q.hints.length : 0} test inputs</span>
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
                <h2 className="text-2xl font-extrabold text-black">{editingId ? "Edit Bug Hunter Question" : "New Bug Hunter Question"}</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">Create a puzzle: provide buggy code, fixed reference code, and test inputs.</p>
              </div>

              {/* Title & Language */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Question Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Enter puzzle title..."
                    className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors placeholder-neutral-400"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Language</label>
                  <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                    className="px-5 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Supposed Behavior Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Explain what this code is supposed to output/do..."
                  className="w-full px-5 py-4 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
                />
              </div>

              {/* Code panes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-red-500">Buggy Code Snippet *</label>
                  <textarea value={form.buggyCode} onChange={(e) => setForm((f) => ({ ...f, buggyCode: e.target.value }))} rows={8} placeholder="Enter buggy code implementation..."
                    className="w-full p-4 rounded-xl text-xs font-mono text-white bg-[#040114] border border-black focus:outline-none focus:border-neutral-500 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold tracking-widest uppercase text-green-600">Corrected / Fixed Reference Code *</label>
                  <textarea value={form.fixedCode} onChange={(e) => setForm((f) => ({ ...f, fixedCode: e.target.value }))} rows={8} placeholder="Enter fixed code implementation..."
                    className="w-full p-4 rounded-xl text-xs font-mono text-white bg-[#040114] border border-black focus:outline-none focus:border-neutral-500 resize-none"
                  />
                </div>
              </div>

              {/* Test Inputs */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Test Inputs (stdin strings run to compare outputs)</label>
                  <button type="button" onClick={addHintField} className="text-xs font-bold text-black cursor-pointer hover:underline">+ Add Test Input</button>
                </div>
                {form.hints.map((hint, i) => (
                  <div key={i} className="rounded-2xl p-4 bg-zinc-50 border-2 border-neutral-200 flex items-center gap-3">
                    <span className="text-xs font-bold text-neutral-400 uppercase whitespace-nowrap">Input #{i + 1}</span>
                    <input type="text" value={hint} onChange={(e) => handleHintChange(i, e.target.value)} placeholder="Stdin arguments/input..."
                      className="flex-1 px-4 py-2.5 rounded-xl text-xs font-mono text-black bg-white border-2 border-neutral-200 focus:outline-none focus:border-black"
                    />
                    {form.hints.length > 1 && (
                      <button type="button" onClick={() => removeHintField(i)} className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer">Delete</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Points, Difficulty, Order */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Difficulty", key: "difficulty" as const, isSelect: true },
                  { label: "Points", key: "points" as const, value: form.points },
                  { label: "Order #", key: "order" as const, value: form.order },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">{item.label}</label>
                    {item.isSelect ? (
                      <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as "easy" | "medium" | "hard" }))}
                        className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    ) : (
                      <input type="number" value={item.value} onChange={(e) => setForm((f) => ({ ...f, [item.key]: Number(e.target.value) }))}
                        className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black text-center"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  {submitting ? "Saving…" : editingId ? "Save Changes" : "Create Puzzle"}
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
                <h2 className="text-2xl font-extrabold text-black">Bulk Import Bug Hunter Questions</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">Paste a JSON array of bug hunter puzzles.</p>
              </div>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} placeholder="Paste JSON array here…"
                className="w-full px-5 py-4 rounded-xl text-xs font-mono text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowBulk(false)} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors">Cancel</button>
                <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()} className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40">
                  {bulkLoading ? "Importing…" : "Import"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
