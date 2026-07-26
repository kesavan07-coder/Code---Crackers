"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface RoundProgress {
  status: "not_started" | "in_progress" | "submitted" | "completed";
  score: number;
  submittedAt: string | null;
  answered?: number;
  total?: number;
  tabSwitches?: number;
}

interface Participant {
  id: string;
  username: string;
  email: string | null;
  department: string | null;
  fullName: string;
  college: string;
  isActive: boolean;
  isApproved: boolean;
  isLocked: boolean;
  loginEnabled: boolean;
  qualificationStatus: "waiting" | "qualified" | "eliminated";
  roundPermissions: Record<number, "open" | "locked" | "skipped" | "completed">;
  timerExtensionSeconds: number;
  scoreOverrides: Record<number, number>;
  isOnline: boolean;
  round1: RoundProgress;
  round2: RoundProgress;
  round3: RoundProgress;
}

interface HistoryLog {
  id: string;
  timestamp: string;
  action: string;
  metadata: any;
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden border border-neutral-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-black"
        />
      </div>
      <span className="text-xs font-bold w-12 text-right text-black">
        {score}/{total}
      </span>
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

export default function AdminParticipantsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"approved" | "pending">("approved");
  
  // Modals & Panels state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ username: string; password: string }[]>([]);

  // Forms and selected participant variables
  const [addForm, setAddForm] = useState({ username: "", password: "", fullName: "", email: "", department: "", college: "" });
  const [generateForm, setGenerateForm] = useState({ count: 10, prefix: "CC", department: "CSBS", college: "Engineering" });
  const [bulkText, setBulkText] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<{ profile: any; logs: HistoryLog[]; submissions?: any } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Score editing states
  const [editingScoreRound, setEditingScoreRound] = useState<number | null>(null);
  const [editingScoreValue, setEditingScoreValue] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.size} selected participants? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/bulk-action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "delete" }),
      });
      if (res.ok) {
        showToast(`Successfully deleted ${selectedIds.size} participants.`);
        setSelectedIds(new Set());
        fetchParticipants();
      } else {
        showToast("Bulk delete failed.", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
  };

  const handleBulkExport = () => {
    const selectedParticipants = participants.filter(p => selectedIds.has(p.id));
    const csvContent = [
      ["Username", "Full Name", "Department", "College", "R1 Score", "R2 Score", "R3 Score", "Total Score", "Status"].join(","),
      ...selectedParticipants.map(p => {
        const total = (p.round1.score || 0) + (p.round2.score || 0) + (p.round3.score || 0);
        return [
          p.username,
          p.fullName || "",
          p.department || "CSBS",
          p.college || "",
          p.round1.score,
          p.round2.score,
          p.round3.score,
          total,
          p.qualificationStatus,
        ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `participants_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export completed successfully.");
  };

  const handleBulkResetPassword = async () => {
    const password = prompt("Enter new password for selected participants:", "pass123");
    if (password === null) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/bulk-action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "reset-password", value: password }),
      });
      if (res.ok) {
        showToast(`Passwords reset to "${password}" for selected participants.`);
        setSelectedIds(new Set());
        fetchParticipants();
      } else {
        showToast("Bulk password reset failed.", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
  };

  const handleBulkLockToggle = async (lock: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/bulk-action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: lock ? "lock" : "unlock" }),
      });
      if (res.ok) {
        showToast(`Successfully ${lock ? "locked" : "unlocked"} ${selectedIds.size} accounts.`);
        setSelectedIds(new Set());
        fetchParticipants();
      } else {
        showToast("Bulk action failed.", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchParticipants = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch {
      showToast("Error connecting to server.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin") { router.replace("/dashboard"); return; }
    fetchParticipants();
    const timer = setInterval(() => fetchParticipants(true), 6000);
    return () => clearInterval(timer);
  }, [token, user, router, fetchParticipants]);

  // Operations
  const handleCreateParticipant = async () => {
    if (!addForm.username || !addForm.password) {
      showToast("Username and Password are required.", "error");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Participant account created successfully!");
        setShowAddModal(false);
        setGeneratedCredentials([{ username: addForm.username, password: addForm.password }]);
        setShowCredentialsModal(true);
        setAddForm({ username: "", password: "", fullName: "", email: "", department: "", college: "" });
        fetchParticipants();
      } else {
        showToast(data.message || "Failed to create.", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
  };

  const handleGenerateCredentials = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(generateForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGenerateModal(false);
        setGeneratedCredentials(data.credentials || []);
        setShowCredentialsModal(true);
        fetchParticipants();
      } else {
        showToast(data.message || "Generation failed.", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
  };

  const handleBulkImport = async () => {
    try {
      let parsed = [];
      if (bulkText.trim().startsWith("[")) {
        parsed = JSON.parse(bulkText);
      } else {
        // Parse CSV format: username,password,fullName,department,college
        const lines = bulkText.trim().split("\n");
        parsed = lines.map(line => {
          const parts = line.split(",");
          return {
            username: parts[0]?.trim(),
            password: parts[1]?.trim() || "pass123",
            fullName: parts[2]?.trim() || "",
            department: parts[3]?.trim() || "",
            college: parts[4]?.trim() || "",
          };
        }).filter(u => u.username);
      }

      const res = await fetch(`${API_BASE}/api/admin/participants/bulk-create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ participants: parsed }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setShowBulkModal(false);
        setBulkText("");
        fetchParticipants();
      } else {
        showToast(data.message || "Import failed.", "error");
      }
    } catch {
      showToast("Invalid JSON or CSV structure.", "error");
    }
  };

  const handleToggleLock = async (p: Participant) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/toggle-lock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: !p.isLocked }),
      });
      if (res.ok) {
        showToast(p.isLocked ? "Account unlocked." : "Account locked.");
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleToggleLogin = async (p: Participant) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/toggle-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loginEnabled: !p.loginEnabled }),
      });
      if (res.ok) {
        showToast(p.loginEnabled ? "Login disabled." : "Login enabled.");
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleResetPassword = async () => {
    if (!selectedParticipant || !newPassword) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${selectedParticipant.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        showToast("Password reset successfully.");
        setShowPasswordModal(false);
        setNewPassword("");
      }
    } catch {}
  };

  const handleDeleteParticipant = async (p: Participant) => {
    if (!confirm(`Are you sure you want to permanently delete ${p.username}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Participant deleted.");
        fetchParticipants();
      }
    } catch {}
  };

  const handleApproveParticipant = async (p: Participant) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast(`${p.username} approved.`);
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/approve-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✅ All waiting participants have been approved successfully.");
        setShowApproveAllModal(false);
        fetchParticipants(true);
      } else {
        showToast(data.message || "Failed to approve all participants.", "error");
      }
    } catch {
      showToast("Server error approving participants.", "error");
    } finally {
      setApprovingAll(false);
    }
  };

  const handleRejectParticipant = async (p: Participant) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast(`${p.username} removed.`);
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleLateJoin = async (p: Participant, round: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/late-join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ round }),
      });
      if (res.ok) {
        showToast(`${p.username} entered Round ${round}.`);
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleSetQualification = async (p: Participant, status: "waiting" | "qualified" | "eliminated") => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/qualification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Qualification set to ${status}.`);
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleOverrideRoundStatus = async (p: Participant, round: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/override-round`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ round, status }),
      });
      if (res.ok) {
        showToast("Round override applied.");
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleExtendTimer = async (p: Participant, seconds: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/extend-timer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });
      if (res.ok) {
        showToast(`Timer extended by ${seconds / 60}m.`);
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleForceSubmit = async (p: Participant, round: number) => {
    if (!confirm(`Force submit Round ${round} for ${p.username}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/force-submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ round }),
      });
      if (res.ok) {
        showToast("Answers forced to submit.");
        fetchParticipants(true);
      }
    } catch {}
  };

  const handleOverrideScore = async (p: Participant, round: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/edit-score`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ round, score: Number(editingScoreValue) }),
      });
      if (res.ok) {
        showToast("Score override saved.");
        setEditingScoreRound(null);
        setEditingScoreValue("");
        fetchParticipants(true);
      }
    } catch {}
  };

  const viewHistory = async (p: Participant) => {
    setSelectedParticipant(p);
    setShowHistoryModal(true);
    setSelectedHistory(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/${p.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSelectedHistory(await res.json());
      }
    } catch {}
  };

  // Bulk Actions
  const handleBulkQualifyByScore = async (minScore: number) => {
    if (!confirm(`Qualify all participants with total score >= ${minScore}?`)) return;
    for (const p of participants) {
      const totalScore = (p.round1.score || 0) + (p.round2.score || 0) + (p.round3.score || 0);
      if (totalScore >= minScore && p.qualificationStatus !== "qualified") {
        await handleSetQualification(p, "qualified");
      }
    }
    showToast("Bulk qualification processed.");
  };

  const handleDownloadCredentialsPDF = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/credentials/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showToast("Failed to fetch credentials.", "error"); return; }
      const data = await res.json();
      const credentials: Array<{ username: string; password: string; fullName: string; department: string; college: string }> = data.credentials;

      // Dynamically import jsPDF (browser only)
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // ─── Header ────────────────────────────────────────────
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CODE CRACKERS", 14, 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("PARTICIPANT LOGIN CREDENTIALS", 14, 18);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  |  Total: ${credentials.length}`, 14, 24);

      // ─── Table ─────────────────────────────────────────────
      autoTable(doc, {
        startY: 34,
        head: [["#", "Username", "Password", "Full Name", "Department"]],
        body: credentials.map((c, i) => [
          i + 1,
          c.username,
          c.password,
          c.fullName || "—",
          c.department || "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 38 },
          2: { cellWidth: 38 },
          3: { cellWidth: 60 },
          4: { cellWidth: 40 },
        },
        margin: { left: 14, right: 14 },
      });

      // ─── Footer ────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} / ${pageCount}  –  Code Crackers Admin  –  CONFIDENTIAL`, 14, 292);
      }

      doc.save(`code_crackers_credentials_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast(`Downloaded credentials PDF for ${credentials.length} participants.`);
    } catch (err) {
      console.error(err);
      showToast("Failed to generate PDF.", "error");
    }
  };

  // Filters
  const filtered = participants.filter((p) => {
    const isMatchedTab = activeSubTab === "approved" ? p.isApproved : !p.isApproved;
    const matchSearch = !searchQuery || 
      p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.department?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (p.college?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return isMatchedTab && matchSearch;
  });

  const totalRegistered = participants.length;
  const onlineCount = participants.filter(p => p.isOnline).length;
  const waitingInLounge = participants.filter(p => !p.isApproved).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      
      {/* Toast Notification */}
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

      <AdminNav active="/admin/participants" />

      {/* Top statistics summary panel */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 py-8 grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "Total Accounts", value: totalRegistered },
          { label: "Online Now", value: onlineCount },
          { label: "Waiting Lounge", value: waitingInLounge },
          { label: "Approved Candidates", value: participants.filter(p => p.isApproved).length },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-6 flex flex-col gap-2 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{s.label}</span>
            <span className="text-3xl font-extrabold tracking-tight text-black">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 pb-6 flex items-center gap-4 flex-wrap">
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name, department, college…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[240px] px-5 py-3 rounded-xl text-sm font-semibold bg-white border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black transition-colors"
        />

        {/* Lounge Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab("approved")}
            className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors ${activeSubTab === "approved" ? "bg-black border-black text-white" : "bg-white border-neutral-200 text-neutral-500 hover:border-black"}`}
          >
            Approved ({participants.filter(p => p.isApproved).length})
          </button>
          <button
            onClick={() => setActiveSubTab("pending")}
            className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors ${activeSubTab === "pending" ? "bg-black border-black text-white" : "bg-white border-neutral-200 text-neutral-500 hover:border-black"}`}
          >
            Lounge Queue ({waitingInLounge})
          </button>
        </div>

        {/* Administration Commands */}
        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={handleDownloadCredentialsPDF}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black transition-colors flex items-center gap-2"
          >
            ⬇ Credentials PDF
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black transition-colors"
          >
            Auto-Gen
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black transition-colors"
          >
            Bulk Uploader
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
          >
            + Create Account
          </button>
          <button
            onClick={() => fetchParticipants(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black"
          >
            {refreshing ? "Syncing…" : "↻"}
          </button>
        </div>
      </div>

      {/* Bulk Selection & Actions Bar */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 pb-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-6 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="select-all"
              checked={filtered.length > 0 && filtered.every(p => selectedIds.has(p.id))}
              onChange={(e) => {
                const newSelected = new Set(selectedIds);
                if (e.target.checked) {
                  filtered.forEach(p => newSelected.add(p.id));
                } else {
                  filtered.forEach(p => newSelected.delete(p.id));
                }
                setSelectedIds(newSelected);
              }}
              className="w-5 h-5 rounded border-2 border-neutral-300 accent-black cursor-pointer"
            />
            <label htmlFor="select-all" className="text-xs font-bold text-black uppercase tracking-wider cursor-pointer select-none">
              Select All
            </label>
          </div>

          <div className="h-4 w-px bg-neutral-200" />

          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest mr-2">
                Selected: {selectedIds.size}
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              >
                Delete Selected
              </button>
              <button
                onClick={handleBulkExport}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                Export Selected
              </button>
              <button
                onClick={handleBulkResetPassword}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                Reset Passwords
              </button>
              <button
                onClick={() => handleBulkLockToggle(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                Lock Selected
              </button>
              <button
                onClick={() => handleBulkLockToggle(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                Unlock Selected
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Select participants below to perform bulk actions
            </span>
          )}

          {activeSubTab === "approved" && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Qualify:</span>
              <button
                onClick={() => handleBulkQualifyByScore(20)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                Score &gt;= 20
              </button>
              <button
                onClick={async () => {
                  if (confirm("Qualify ALL approved participants?")) {
                    for (const p of filtered) {
                      await handleSetQualification(p, "qualified");
                    }
                    showToast("All approved candidates qualified.");
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-black border border-neutral-300 hover:border-black transition-colors cursor-pointer"
              >
                All Approved
              </button>
            </div>
          )}

          {activeSubTab === "pending" && (
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => setShowApproveAllModal(true)}
                disabled={waitingInLounge === 0}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-black text-white border-2 border-black hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                ✅ Approve All ({waitingInLounge})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main List */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-12 pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl opacity-20">👥</div>
            <p className="text-xl font-extrabold text-neutral-400 tracking-tight">
              {activeSubTab === "approved" ? "No approved participants." : "No one waiting in the Lounge."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p, idx) => {
              const isExpanded = expandedId === p.id;
              const totalScore = (p.round1.score || 0) + (p.round2.score || 0) + (p.round3.score || 0);

              return (
                <div key={p.id} className="flex flex-col">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedIds);
                        if (e.target.checked) {
                          newSelected.add(p.id);
                        } else {
                          newSelected.delete(p.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                      className="w-5 h-5 rounded border-2 border-neutral-300 accent-black cursor-pointer flex-shrink-0"
                    />
                    
                    {/* Participant Header Bar */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className={`flex-1 rounded-2xl p-5 flex items-center gap-5 transition-all cursor-pointer bg-white border-2 ${isExpanded ? 'border-black' : 'border-neutral-200 hover:border-neutral-400'} shadow-[0_4px_20px_rgb(0,0,0,0.03)]`}
                    >
                      {/* Rank or Online Dot */}
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-extrabold text-sm ${p.isOnline ? 'bg-black text-white' : 'bg-zinc-100 text-neutral-500'}`}>
                        {p.isOnline ? "●" : "○"}
                      </div>

                    {/* Meta Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="font-extrabold text-black text-base truncate">{p.username}</span>
                        {p.fullName && <span className="text-xs font-semibold text-neutral-400">({p.fullName})</span>}
                        {p.round1.tabSwitches && p.round1.tabSwitches > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-600">
                            ⚠ {p.round1.tabSwitches} switches
                          </span>
                        ) : null}

                        {/* Status badges */}
                        {p.isLocked && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">LOCKED</span>}
                        {!p.loginEnabled && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-400 text-white">LOGIN DISABLED</span>}
                        
                        {/* Qualification badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          p.qualificationStatus === "qualified" ? "bg-black text-white" :
                          p.qualificationStatus === "eliminated" ? "bg-red-50 text-red-600 border border-red-200" :
                          "bg-zinc-100 text-neutral-500"
                        }`}>
                          {p.qualificationStatus.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-neutral-500 font-semibold">
                        <span>{p.department || "CSBS"}</span>
                        <span>•</span>
                        <span>{p.college || "Codeville"}</span>
                      </div>
                    </div>

                    {/* Progress indicators */}
                    <div className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px]">R1 MCQ</span>
                        <span className={p.round1.status === "submitted" ? "text-black" : ""}>{p.round1.score} pts</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px]">R2 CODE</span>
                        <span className={p.round2.status === "submitted" ? "text-black" : ""}>{p.round2.score} pts</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px]">R3 BUG</span>
                        <span className={p.round3.status === "submitted" ? "text-black" : ""}>{p.round3.score} pts</span>
                      </div>
                    </div>

                    {/* Total score block */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-2xl flex flex-col items-center justify-center bg-zinc-900 border-2 border-black text-white">
                      <span className="text-xl font-extrabold">{totalScore}</span>
                      <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">SCORE</span>
                    </div>

                    <div className={`w-5 h-5 flex items-center justify-center text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                  </div>

                  {/* Extended Configuration and Control Panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2 mb-4 rounded-b-2xl border-2 border-t-0 border-black bg-zinc-50 p-6 flex flex-col gap-6">
                          
                          {/* Row 1: Profile metadata and state locks */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            
                            {/* Profile details */}
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-2">Metadata Details</span>
                              <p className="text-xs font-bold text-black mb-1">Email: <span className="text-neutral-600 font-semibold">{p.email || "—"}</span></p>
                              <p className="text-xs font-bold text-black mb-1">Extension: <span className="text-neutral-600 font-semibold">{p.timerExtensionSeconds}s</span></p>
                              <p className="text-xs font-bold text-black">Active session: <span className="text-neutral-600 font-semibold">{p.isOnline ? "Active" : "None"}</span></p>
                            </div>

                            {/* Qualification status controls */}
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">Qualification</span>
                              <div className="flex gap-1.5">
                                {(["waiting", "qualified", "eliminated"] as const).map(status => (
                                  <button
                                    key={status}
                                    onClick={() => handleSetQualification(p, status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                      p.qualificationStatus === status
                                        ? "bg-black text-white border-black"
                                        : "bg-white text-neutral-500 border-neutral-300 hover:border-black"
                                    }`}
                                  >
                                    {status === "waiting" ? "Wait" : status === "qualified" ? "Qualify" : "Eliminate"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Waiting Room controls */}
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">Lounge / Join Status</span>
                              {p.isApproved ? (
                                <button
                                  onClick={() => handleRejectParticipant(p)}
                                  className="w-full py-2 rounded-lg text-xs font-bold bg-white border border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                  Move to Lounge Queue
                                </button>
                              ) : (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleApproveParticipant(p)}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-black text-white hover:bg-neutral-800"
                                  >
                                    Approve Entrance
                                  </button>
                                  <select
                                    onChange={(e) => handleLateJoin(p, Number(e.target.value))}
                                    defaultValue=""
                                    className="px-2.5 py-2 rounded-lg text-xs font-bold bg-white border border-neutral-300 text-black cursor-pointer"
                                  >
                                    <option value="" disabled>Late Join</option>
                                    <option value="1">R1</option>
                                    <option value="2">R2</option>
                                    <option value="3">R3</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Utility commands */}
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">Account Admin</span>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => handleToggleLock(p)}
                                  className={`py-1.5 rounded-lg text-xs font-bold border ${p.isLocked ? "bg-red-600 text-white border-red-600" : "bg-white border-neutral-300 text-black hover:border-black"}`}
                                >
                                  {p.isLocked ? "Unlock" : "Lock"}
                                </button>
                                <button
                                  onClick={() => handleToggleLogin(p)}
                                  className={`py-1.5 rounded-lg text-xs font-bold border ${!p.loginEnabled ? "bg-neutral-400 text-white border-neutral-400" : "bg-white border-neutral-300 text-black hover:border-black"}`}
                                >
                                  {p.loginEnabled ? "Disable" : "Enable"}
                                </button>
                                <button
                                  onClick={() => { setSelectedParticipant(p); setShowPasswordModal(true); }}
                                  className="py-1.5 rounded-lg text-xs font-bold bg-white border border-neutral-300 hover:border-black"
                                >
                                  Pass Reset
                                </button>
                                <button
                                  onClick={() => handleDeleteParticipant(p)}
                                  className="py-1.5 rounded-lg text-xs font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                          </div>

                          {/* Row 2: Round-specific status control overrides & score overrides */}
                          <div className="border-t border-neutral-200 pt-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block mb-4">Manual Round Override and Timing</span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {[1, 2, 3].map((rId) => {
                                const rProg = rId === 1 ? p.round1 : rId === 2 ? p.round2 : p.round3;
                                const perm = p.roundPermissions?.[rId] || "locked";
                                const isScoreEditing = editingScoreRound === rId;

                                return (
                                  <div key={rId} className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                                      <span className="text-xs font-bold text-black uppercase">Round 0{rId} override</span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-neutral-500 uppercase">{perm}</span>
                                    </div>

                                    {/* Action Buttons to Override state */}
                                    <div className="flex gap-1 flex-wrap">
                                      {(["open", "locked", "skipped", "completed"] as const).map(state => (
                                        <button
                                          key={state}
                                          onClick={() => handleOverrideRoundStatus(p, rId, state)}
                                          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                            perm === state
                                              ? "bg-black text-white border-black"
                                              : "bg-white text-neutral-500 border-neutral-200 hover:border-black"
                                          }`}
                                        >
                                          {state}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Score display & Override */}
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100">
                                      <span className="font-semibold text-neutral-500">Score Override:</span>
                                      {isScoreEditing ? (
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            value={editingScoreValue}
                                            onChange={(e) => setEditingScoreValue(e.target.value)}
                                            className="w-12 px-1 py-0.5 border text-center text-xs font-bold focus:outline-none"
                                            placeholder={`${rProg.score}`}
                                          />
                                          <button onClick={() => handleOverrideScore(p, rId)} className="text-black hover:text-neutral-600 font-bold">✓</button>
                                          <button onClick={() => setEditingScoreRound(null)} className="text-red-500 font-bold">✕</button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold text-black">{rProg.score} pts</span>
                                          <button
                                            onClick={() => { setEditingScoreRound(rId); setEditingScoreValue(`${rProg.score}`); }}
                                            className="text-[10px] font-bold text-neutral-400 hover:text-black hover:underline"
                                          >
                                            Edit
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Individual controls */}
                                    <div className="flex gap-2 justify-between items-center text-xs">
                                      <button
                                        onClick={() => handleForceSubmit(p, rId)}
                                        disabled={rProg.status === "submitted" || rProg.status === "completed"}
                                        className="text-[10px] font-bold text-neutral-400 hover:text-red-600 disabled:opacity-40"
                                      >
                                        Force Submit
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleExtendTimer(p, 300)}
                                          className="px-2 py-0.5 rounded bg-zinc-100 border border-neutral-200 text-[10px] font-bold hover:border-black"
                                        >
                                          +5m Timer
                                        </button>
                                      </div>
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Row 3: Action Logs */}
                          <div className="border-t border-neutral-200 pt-6 flex items-center gap-4 flex-wrap">
                            <button
                              onClick={() => viewHistory(p)}
                              className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black text-black"
                            >
                              View Action Log / Login History
                            </button>
                            {p.round1.status === "submitted" && (
                              <a
                                href={`/admin/participants/submission/${p.id}?round=1`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black transition-colors text-black"
                              >
                                R1 Submission
                              </a>
                            )}
                            {p.round2.status === "submitted" && (
                              <a
                                href={`/admin/participants/submission/${p.id}?round=2`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 bg-white hover:border-black transition-colors text-black"
                              >
                                R2 Submission
                              </a>
                            )}
                            {p.round3.status === "submitted" && (
                              <a
                                href={`/admin/participants/submission/${p.id}?round=3`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-black bg-black text-white hover:bg-neutral-800 transition-colors"
                              >
                                R3 Submission
                              </a>
                            )}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Participant Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-xl rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl"
            >
              <h2 className="text-xl font-extrabold text-black mb-1">Create Participant</h2>
              <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Add a single student account</p>

              <div className="flex flex-col gap-4">
                {[
                  { key: "username", label: "Username *", placeholder: "e.g. participant1", type: "text" },
                  { key: "password", label: "Password *", placeholder: "Password here...", type: "password" },
                  { key: "fullName", label: "Full Name", placeholder: "e.g. John Doe", type: "text" },
                  { key: "email", label: "Email", placeholder: "e.g. john@college.edu", type: "email" },
                  { key: "department", label: "Department", placeholder: "e.g. CSBS", type: "text" },
                  { key: "college", label: "College Name", placeholder: "e.g. Engineering College", type: "text" },
                ].map((input) => (
                  <div key={input.key} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{input.label}</label>
                    <input
                      type={input.type}
                      placeholder={input.placeholder}
                      value={(addForm as any)[input.key]}
                      onChange={(e) => setAddForm(prev => ({ ...prev, [input.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateParticipant}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Create Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Generate Credentials Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-md rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl"
            >
              <h2 className="text-xl font-extrabold text-black mb-1">Auto-Generate Credentials</h2>
              <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Create bulk accounts instantly</p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Number of Accounts</label>
                  <input
                    type="number"
                    value={generateForm.count}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, count: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Username Prefix</label>
                  <input
                    type="text"
                    value={generateForm.prefix}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, prefix: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Department</label>
                  <input
                    type="text"
                    value={generateForm.department}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">College</label>
                  <input
                    type="text"
                    value={generateForm.college}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, college: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateCredentials}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Generate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Uploader Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-2xl rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl"
            >
              <h2 className="text-xl font-extrabold text-black mb-1">Bulk Upload Participants</h2>
              <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Paste JSON array or CSV structure</p>

              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block mb-1.5">CSV Format Template (Line separated)</span>
                <div className="bg-zinc-50 border border-neutral-200 rounded-xl p-3 text-xs font-mono text-neutral-500 leading-normal">
                  username,password,fullName,department,college<br/>
                  candidate1,pass1,Candidate One,CSBS,College A<br/>
                  candidate2,pass2,Candidate Two,ECE,College B
                </div>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder="Paste CSV rows or JSON array here..."
                className="w-full px-4 py-3 rounded-xl text-xs font-mono bg-zinc-50 border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black resize-none"
              />

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Import Data
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPasswordModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-sm rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl"
            >
              <h2 className="text-xl font-extrabold text-black mb-1">Reset Password</h2>
              <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">For student: {selectedParticipant?.username}</p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm font-semibold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer border-2 border-neutral-200 bg-white text-neutral-500 hover:border-black hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  className="flex-1 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Save Password
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History & Logs Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowHistoryModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-3xl rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold text-black">Participant Activity History</h2>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Login logs & session activity for: {selectedParticipant?.username}</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-black">✕ Close</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                {!selectedHistory ? (
                  <div className="py-24 flex justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  </div>
                ) : selectedHistory.logs.length === 0 ? (
                  <div className="py-24 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    No history logs registered for this participant.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedHistory.logs.map((log) => (
                      <div key={log.id} className="bg-zinc-50 border border-neutral-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-extrabold text-black uppercase tracking-wide">{log.action}</span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Metadata: {JSON.stringify(log.metadata)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-400 tabular-nums">
                          {new Date(log.timestamp).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedHistory && selectedHistory.submissions && (
                <div className="mt-6 border-t border-neutral-200 pt-6 flex-1 overflow-y-auto">
                  <h3 className="text-sm font-extrabold text-black mb-4 uppercase tracking-widest">Submissions Data</h3>
                  <div className="flex flex-col gap-4">
                    {[1, 2, 3].map(r => {
                      const sub = selectedHistory.submissions[`round${r}`];
                      if (!sub) return null;
                      return (
                        <div key={r} className="bg-zinc-50 border border-neutral-200 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-extrabold text-black uppercase">Round {r}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black text-white">{sub.status}</span>
                          </div>
                          <pre className="text-[10px] font-mono text-neutral-500 overflow-x-auto p-2 bg-white border border-neutral-200 rounded">
                            {JSON.stringify(sub.answers, null, 2)}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated Credentials Viewer Modal */}
      <AnimatePresence>
        {showCredentialsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-2xl rounded-3xl bg-white border border-neutral-200 shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-8 pb-4 border-b border-neutral-100 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-black">Generated Credentials</h2>
                  <p className="text-xs font-semibold text-neutral-500 mt-1 uppercase tracking-wider">
                    {generatedCredentials.length} accounts created — save these passwords now, they won't be shown again
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const text = generatedCredentials.map(c => `${c.username}\t${c.password}`).join("\n");
                      const copyText = async () => {
                        try {
                          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                            await navigator.clipboard.writeText(text);
                            showToast("All credentials copied to clipboard!");
                            return;
                          }
                        } catch (e) {
                          console.warn("Clipboard writeText error:", e);
                        }
                        try {
                          const textArea = document.createElement("textarea");
                          textArea.value = text;
                          textArea.style.position = "fixed";
                          textArea.style.left = "-999999px";
                          textArea.style.top = "-999999px";
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          const ok = document.execCommand("copy");
                          textArea.remove();
                          showToast(ok ? "All credentials copied to clipboard!" : "Failed to copy credentials.");
                        } catch {
                          showToast("Failed to copy credentials.");
                        }
                      };
                      copyText();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-neutral-200 hover:border-black bg-white text-black transition-colors"
                  >
                    Copy All
                  </button>
                  <button
                    onClick={() => {
                      // Download as CSV
                      const csv = "Username,Password\n" + generatedCredentials.map(c => `${c.username},${c.password}`).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "credentials.csv";
                      a.click();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Credentials Table */}
              <div className="overflow-y-auto flex-1 px-8 py-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-neutral-200">
                      <th className="pb-3 text-xs font-bold uppercase tracking-widest text-neutral-500 w-8">#</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">Username</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">Password</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-widest text-neutral-500 w-20 text-right">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {generatedCredentials.map((cred, i) => (
                      <tr key={cred.username} className="hover:bg-stone-50 transition-colors">
                        <td className="py-3 text-xs font-bold text-neutral-400 tabular-nums">{i + 1}</td>
                        <td className="py-3">
                          <span className="font-extrabold text-black text-sm">{cred.username}</span>
                        </td>
                        <td className="py-3">
                          <code className="font-mono text-sm font-bold text-black bg-zinc-100 px-2 py-0.5 rounded-lg">
                            {cred.password}
                          </code>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              const text = `${cred.username} / ${cred.password}`;
                              const copySingle = async () => {
                                try {
                                  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                                    await navigator.clipboard.writeText(text);
                                    showToast(`Copied ${cred.username}`);
                                    return;
                                  }
                                } catch (e) {
                                  console.warn("Clipboard writeText error:", e);
                                }
                                try {
                                  const textArea = document.createElement("textarea");
                                  textArea.value = text;
                                  textArea.style.position = "fixed";
                                  textArea.style.left = "-999999px";
                                  textArea.style.top = "-999999px";
                                  document.body.appendChild(textArea);
                                  textArea.focus();
                                  textArea.select();
                                  const ok = document.execCommand("copy");
                                  textArea.remove();
                                  showToast(ok ? `Copied ${cred.username}` : "Failed to copy.");
                                } catch {
                                  showToast("Failed to copy.");
                                }
                              };
                              copySingle();
                            }}
                            className="text-[10px] font-bold text-neutral-400 hover:text-black uppercase tracking-widest"
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="p-8 pt-4 border-t border-neutral-100">
                <button
                  onClick={() => setShowCredentialsModal(false)}
                  className="w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors"
                >
                  Done — I've saved the passwords
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approve All Modal Dialog */}
      <AnimatePresence>
        {showApproveAllModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowApproveAllModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-md rounded-3xl p-8 bg-white border border-neutral-200 shadow-2xl flex flex-col gap-6 text-center"
            >
              <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center text-black border border-neutral-200 mx-auto">
                <span className="text-2xl">✅</span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-black mb-2">Approve All Participants?</h2>
                <p className="text-sm font-semibold text-neutral-500 leading-relaxed">
                  This action will approve all {waitingInLounge} participant{waitingInLounge === 1 ? "" : "s"} currently waiting in the queue.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowApproveAllModal(false)}
                  className="py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-neutral-200 hover:border-black text-black transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  className="py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {approvingAll ? "Approving…" : "Approve All"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>

  );
}
