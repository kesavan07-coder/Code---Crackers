"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface MCQQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: "easy" | "medium" | "hard";
  order: number;
}

const DIFF_CLASSES = {
  easy:   "bg-zinc-100 text-neutral-600",
  medium: "bg-zinc-200 text-black",
  hard:   "bg-black text-white",
};

const EMPTY_FORM = {
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  difficulty: "medium" as "easy" | "medium" | "hard",
  order: 0,
};

function AdminNav({ active }: { active: string }) {
  const router = useRouter();
  const { logout } = useAuth();
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

export default function AdminQuestionsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
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
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/mcq`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setQuestions(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin") { router.replace("/dashboard"); return; }
    fetchQuestions();
  }, [token, user, router, fetchQuestions]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order: questions.length + 1 });
    setShowForm(true);
  };

  const openEdit = (q: MCQQuestion) => {
    setEditingId(q.id);
    setForm({ questionText: q.questionText, options: [...q.options], correctAnswer: q.correctAnswer, difficulty: q.difficulty, order: q.order });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.questionText.trim()) { showToast("Question text is required.", "error"); return; }
    if (form.options.some((o) => !o.trim())) { showToast("All 4 options must be filled.", "error"); return; }
    setSubmitting(true);
    try {
      const url = editingId ? `${API_BASE}/api/admin/questions/mcq/${editingId}` : `${API_BASE}/api/admin/questions/mcq`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { showToast(editingId ? "Question updated." : "Question created."); setShowForm(false); fetchQuestions(); }
      else showToast(data.message || "Failed.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/mcq/${id}`, {
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
      const res = await fetch(`${API_BASE}/api/admin/questions/mcq/bulk-import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ questions: qs }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message); setBulkText(""); setShowBulk(false); fetchQuestions(); }
      else showToast(data.message || "Import failed.", "error");
    } catch { showToast("Invalid JSON format.", "error"); }
    finally { setBulkLoading(false); }
  };

  const filtered = questions.filter((q) => {
    const matchDiff = diffFilter === "all" || q.difficulty === diffFilter;
    const matchSearch = !searchQuery || q.questionText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDiff && matchSearch;
  });

  if (authLoading || loading) {
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

      <AdminNav active="/admin/questions" />

      {/* Subtabs */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex justify-between items-center border-b border-neutral-200 pb-0">
        <div className="flex gap-1">
          {[
            { label: "Round 1: MCQs", href: "/admin/questions" },
            { label: "Round 2: Coding", href: "/admin/questions/coding" },
            { label: "Round 3: Bug Hunter", href: "/admin/questions/debug" },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`px-5 py-3 text-xs font-bold tracking-wider uppercase cursor-pointer border-b-2 transition-colors ${pathname === item.href ? 'border-black text-black' : 'border-transparent text-neutral-400 hover:text-black'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-0 pb-3">
          <button
            onClick={() => setShowBulk(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-6 flex items-center gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search questions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-5 py-3 rounded-xl text-sm font-semibold bg-white border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black transition-colors"
        />
        {(["all", "easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDiffFilter(d)}
            className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors ${diffFilter === d ? 'bg-black border-black text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:border-black'}`}
          >
            {d === "all" ? "All" : d}
          </button>
        ))}
      </div>

      {/* Question list */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-12 pb-12">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl opacity-20">📝</div>
            <p className="text-xl font-extrabold text-neutral-400 tracking-tight">
              {questions.length === 0 ? "No questions yet. Add some!" : "No results match your filter."}
            </p>
            {questions.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-2 px-8 py-4 rounded-xl text-sm font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
              >
                + Add First Question
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.02 }}
                className="rounded-2xl p-6 flex flex-col md:flex-row md:items-start gap-5 bg-white border-2 border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
              >
                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-extrabold text-sm bg-zinc-100 text-black">
                  {q.order}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black leading-relaxed mb-4">{q.questionText}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, i) => {
                      const isCorrect = i === q.correctAnswer;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold border-2 ${isCorrect ? 'bg-black border-black text-white' : 'bg-zinc-50 border-neutral-200 text-neutral-600'}`}
                        >
                          <span className="font-bold opacity-60">{String.fromCharCode(65 + i)}.</span>
                          <span className="truncate">{opt}</span>
                          {isCorrect && <span className="ml-auto font-bold">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex md:flex-col items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${DIFF_CLASSES[q.difficulty]}`}>
                    {q.difficulty}
                  </span>
                  <button
                    onClick={() => openEdit(q)}
                    className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-neutral-200 bg-white text-black hover:border-black transition-colors"
                  >
                    Edit
                  </button>
                  {deleteConfirm === q.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer bg-red-600 text-white border-2 border-red-600 hover:bg-red-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(q.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-red-100 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
                    >
                      Delete
                    </button>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl rounded-3xl p-8 md:p-10 flex flex-col gap-6 max-h-[90vh] overflow-y-auto bg-white border border-neutral-200 shadow-2xl"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-black">{editingId ? "Edit Question" : "New Question"}</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">Fill in all fields. Mark the correct answer option.</p>
              </div>

              {/* Question Text */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Question Text *</label>
                <textarea
                  value={form.questionText}
                  onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
                  rows={3}
                  placeholder="Enter the question…"
                  className="w-full px-5 py-4 rounded-xl text-sm font-semibold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
                />
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Answer Options (click the letter to mark correct)</label>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <button
                      onClick={() => setForm((f) => ({ ...f, correctAnswer: i }))}
                      className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-extrabold text-sm cursor-pointer border-2 transition-colors ${form.correctAnswer === i ? 'bg-black border-black text-white' : 'bg-zinc-100 border-neutral-200 text-neutral-500 hover:border-black'}`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const opts = [...form.options];
                        opts[i] = e.target.value;
                        setForm((f) => ({ ...f, options: opts }));
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}…`}
                      className={`flex-1 px-5 py-3 rounded-xl text-sm font-semibold text-black bg-white border-2 focus:outline-none focus:border-black transition-colors placeholder-neutral-400 ${form.correctAnswer === i ? 'border-black' : 'border-neutral-200'}`}
                    />
                  </div>
                ))}
              </div>

              {/* Metadata row */}
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as "easy" | "medium" | "hard" }))}
                    className="px-5 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 w-28">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Order #</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                    className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black text-center"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowBulk(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl rounded-3xl p-10 flex flex-col gap-6 bg-white border border-neutral-200 shadow-2xl"
            >
              <div>
                <h2 className="text-2xl font-extrabold text-black">Bulk Import Questions</h2>
                <p className="text-sm font-semibold mt-1 text-neutral-500">
                  Paste a JSON array of questions. Each must have: questionText, options (4 items), correctAnswer (0-3), difficulty, order.
                </p>
              </div>

              <div className="rounded-xl p-4 text-xs font-mono border-2 border-neutral-200 bg-zinc-50 text-neutral-500">
                {`[{"questionText":"What is Big O?","options":["Notation","Algorithm","Language","Tool"],"correctAnswer":0,"difficulty":"easy","order":1}]`}
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder="Paste JSON array here…"
                className="w-full px-5 py-4 rounded-xl text-xs font-mono text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black transition-colors resize-none placeholder-neutral-400"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulk(false)}
                  className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={bulkLoading || !bulkText.trim()}
                  className="flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
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
