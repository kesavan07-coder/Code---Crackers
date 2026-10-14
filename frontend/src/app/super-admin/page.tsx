"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

import { usePortal } from "@/lib/portalContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ── Nav Bar ────────────────────────────────────────────────────────────
function SuperAdminNav({ logout, user }: { logout: () => void; user: any }) {
  const router = useRouter();
  const { portalSettings } = usePortal();
  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b border-neutral-800">
      <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white text-black rounded-xl flex items-center justify-center font-black text-sm select-none">
            👑
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
              {portalSettings.eventName || "Super Admin"} Command Center
              <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Highest Authority
              </span>
            </span>
            <span className="text-xs text-neutral-400 font-medium">Logged in as @{user?.username || "superadmin"}</span>
          </div>
        </div>
        <nav className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push("/admin/portal")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase border border-neutral-700 hover:border-white text-neutral-300 hover:text-white transition-all"
          >
            🏛️ Portal Management
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase border border-neutral-700 hover:border-white text-neutral-300 hover:text-white transition-all"
          >
            📋 Admin Dashboard
          </button>
          <button
            onClick={logout}
            className="ml-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2 py-1 bg-red-950/40 border border-red-800/60 rounded-lg"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border-2 shadow-xl text-sm font-bold ${
        type === "success" ? "bg-white border-black text-black" : "bg-white border-red-500 text-red-600"
      }`}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{msg}</span>
    </motion.div>
  );
}

// ── Dynamic Rounds Tab Component ─────────────────────────────────────
function DynamicRoundsTab({ token, router, showToast }: {
  token: string | null;
  router: ReturnType<typeof import("next/navigation").useRouter>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const { dynamicRounds, refreshPortalInfo } = usePortal();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRound, setEditingRound] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchRounds = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/portal/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRounds(data.dynamicRounds || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchRounds(); }, [token]);

  // Keep local rounds in sync with portal context updates
  useEffect(() => {
    if (dynamicRounds.length > 0) setRounds(dynamicRounds);
  }, [dynamicRounds]);

  const deleteRound = async (id: string) => {
    if (!confirm("Delete this round? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/portal/rounds/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast("Round deleted.");
      await fetchRounds();
      await refreshPortalInfo();
    } catch { showToast("Failed to delete round.", "error"); }
  };

  const toggleEnabled = async (r: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/portal/rounds/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...r, enabled: !r.enabled }),
      });
      if (!res.ok) throw new Error();
      showToast(`Round ${!r.enabled ? "enabled" : "disabled"}.`);
      await fetchRounds();
      await refreshPortalInfo();
    } catch { showToast("Failed to update round.", "error"); }
  };

  const duplicateRound = async (r: any) => {
    try {
      const { id, order, ...rest } = r;
      const res = await fetch(`${API_BASE}/api/portal/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...rest, name: `${r.name} (Copy)` }),
      });
      if (!res.ok) throw new Error();
      showToast("Round duplicated.");
      await fetchRounds();
      await refreshPortalInfo();
    } catch { showToast("Failed to duplicate round.", "error"); }
  };

  const saveEdit = async () => {
    if (!editingRound) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/rounds/${editingRound.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingRound),
      });
      if (!res.ok) throw new Error();
      showToast("Round updated successfully.");
      setEditingRound(null);
      await fetchRounds();
      await refreshPortalInfo();
    } catch { showToast("Failed to save round.", "error"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-black flex items-center gap-2"><span>🔄</span> Dynamic Round Manager</h2>
            <p className="text-xs text-neutral-500 mt-1">Edit, reorder, enable/disable, or delete rounds. Changes reflect everywhere immediately.</p>
          </div>
          <button
            onClick={() => router.push("/admin/portal?tab=rounds")}
            className="bg-black text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all"
          >
            + Create New Round
          </button>
        </div>

        {rounds.length === 0 ? (
          <div className="text-center py-10 text-neutral-400 text-sm">No rounds configured yet.</div>
        ) : (
          <div className="space-y-3">
            {[...rounds].sort((a, b) => (a.order || 0) - (b.order || 0)).map((r) => (
              <div key={r.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${r.enabled ? "border-neutral-200 hover:border-black" : "border-neutral-100 bg-zinc-50 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{r.icon || "🏁"}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-black text-sm">{r.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-neutral-600 font-bold uppercase">{r.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.enabled ? "bg-black text-white" : "bg-zinc-200 text-neutral-500"}`}>
                        {r.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{r.description}</div>
                    <div className="flex gap-3 mt-1 text-xs text-neutral-400 font-semibold">
                      <span>⏱ {r.timeLimit}min</span>
                      <span>🎯 Pass: {r.passingScore}%</span>
                      <span>📊 Max: {r.maxScore}pts</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setEditingRound({ ...r })}
                    className="px-3 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => toggleEnabled(r)}
                    className="px-3 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                  >
                    {r.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => duplicateRound(r)}
                    className="px-3 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                  >
                    ⧉ Clone
                  </button>
                  {!r.id.startsWith("built_in") && (
                    <button
                      onClick={() => deleteRound(r.id)}
                      className="px-3 py-1.5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline Edit Modal */}
      <AnimatePresence>
        {editingRound && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditingRound(null); }}
          >
            <motion.div
              className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            >
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-xl font-extrabold text-black">Edit Round</h2>
                <p className="text-xs text-neutral-500 mt-1">Changes will update across the portal immediately.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Round Name</label>
                    <input value={editingRound.name} onChange={(e) => setEditingRound((r: any) => ({ ...r, name: e.target.value }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Description</label>
                    <textarea value={editingRound.description} onChange={(e) => setEditingRound((r: any) => ({ ...r, description: e.target.value }))} rows={2}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Icon (Emoji)</label>
                    <input value={editingRound.icon} onChange={(e) => setEditingRound((r: any) => ({ ...r, icon: e.target.value }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Time Limit (min)</label>
                    <input type="number" min={5} max={180} value={editingRound.timeLimit}
                      onChange={(e) => setEditingRound((r: any) => ({ ...r, timeLimit: Number(e.target.value) }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Max Score</label>
                    <input type="number" min={10} value={editingRound.maxScore}
                      onChange={(e) => setEditingRound((r: any) => ({ ...r, maxScore: Number(e.target.value) }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Passing Score</label>
                    <input type="number" min={0} max={editingRound.maxScore} value={editingRound.passingScore}
                      onChange={(e) => setEditingRound((r: any) => ({ ...r, passingScore: Number(e.target.value) }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-500 block mb-1.5">Order</label>
                    <input type="number" min={1} value={editingRound.order}
                      onChange={(e) => setEditingRound((r: any) => ({ ...r, order: Number(e.target.value) }))}
                      className="w-full bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm font-medium outline-none" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: "enabled", label: "Enabled" },
                    { key: "leaderboardEnabled", label: "Leaderboard" },
                    { key: "antiCheatEnabled", label: "Anti-Cheat" },
                    { key: "autoSubmitOnTimeout", label: "Auto-Submit on Timeout" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input type="checkbox" checked={!!editingRound[key]}
                        onChange={(e) => setEditingRound((r: any) => ({ ...r, [key]: e.target.checked }))}
                        className="w-4 h-4 accent-black" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
                <button onClick={() => setEditingRound(null)}
                  className="px-5 py-2 rounded-xl border-2 border-neutral-200 hover:border-black font-bold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "admins" | "portal" | "rounds" | "security" | "logs">("overview");

  const [admins, setAdmins] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [compStatus, setCompStatus] = useState<any>(null);

  // Admin Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<{
    id?: string;
    username: string;
    password?: string;
    fullName: string;
    email: string;
    department: string;
    role: "super_admin" | "admin";
    permissions: string[];
  }>({
    username: "", password: "", fullName: "", email: "", department: "CSBS", role: "admin", permissions: ["view_participants"],
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });

  // Guard: Only super_admin allowed
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        router.replace("/login");
        return;
      }
      if (user && user.role !== "super_admin") {
        router.replace("/admin");
        return;
      }
    }
  }, [authLoading, token, user, router]);

  // Fetch Super Admin Data
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      // Fetch admins
      const resAdmins = await fetch(`${API_BASE}/api/admin/management`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAdmins.ok) {
        const data = await resAdmins.json();
        setAdmins(data.admins || []);
        setAvailablePermissions(data.availablePermissions || []);
      }

      // Fetch competition status
      const resComp = await fetch(`${API_BASE}/api/competition/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resComp.ok) {
        const comp = await resComp.json();
        setCompStatus(comp.status || comp);
      }

      // Fetch activity logs
      const resLogs = await fetch(`${API_BASE}/api/admin/participants/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resLogs.ok) {
        const logData = await resLogs.json();
        setActivityLogs(logData.logs || []);
      }
    } catch {
      showToast("Error loading Super Admin data.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-black">
      <SuperAdminNav logout={logout} user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
        <AnimatePresence>
          {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>

        {/* Hero Header */}
        <div className="bg-black text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider border border-white/20">
              ⚡ Super Admin Authority Matrix
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              System Control Panel
            </h1>
            <p className="text-neutral-400 text-sm sm:text-base max-w-2xl font-medium">
              You are logged in with maximum authorization. You can configure portal branding, manage administrators, assign permissions, modify competition rules, and access low-level security logs.
            </p>
            <div className="flex gap-3 flex-wrap pt-2">
              <button
                onClick={() => router.push("/admin/portal")}
                className="bg-white text-black font-extrabold text-xs px-5 py-2.5 rounded-xl hover:bg-neutral-200 transition-all flex items-center gap-2"
              >
                ⚙️ Portal Management Center
              </button>
              <button
                onClick={() => router.push("/admin/portal?tab=security")}
                className="bg-neutral-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border border-neutral-700 hover:border-white transition-all flex items-center gap-2"
              >
                🔒 Anti-Cheat & Security
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 gap-2 overflow-x-auto pb-1">
          {[
            { id: "overview", label: "Overview & Stats", icon: "📊" },
            { id: "admins", label: "Admin Accounts & Roles", icon: "🛡️" },
            { id: "portal", label: "Portal & Event Control", icon: "🏛️" },
            { id: "rounds", label: "Dynamic Rounds", icon: "🔄" },
            { id: "security", label: "Security & Anti-Cheat", icon: "🔒" },
            { id: "logs", label: "Activity Audit Log", icon: "📜" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-2 border-2 ${
                activeTab === tab.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-black"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 border-2 border-neutral-200 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Super Admins</span>
                <span className="text-3xl font-black text-black">
                  {admins.filter((a) => a.role === "super_admin").length}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">Full Authority Accounts</span>
              </div>
              <div className="bg-white rounded-2xl p-6 border-2 border-neutral-200 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Active Admin Accounts</span>
                <span className="text-3xl font-black text-black">
                  {admins.filter((a) => a.role === "admin").length}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">Granular Permission Accounts</span>
              </div>
              <div className="bg-white rounded-2xl p-6 border-2 border-neutral-200 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Competition State</span>
                <span className="text-xl font-extrabold text-black uppercase">
                  {compStatus?.competitionState || "IDLE"}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">Current Round: {compStatus?.currentRound || 1}</span>
              </div>
              <div className="bg-white rounded-2xl p-6 border-2 border-neutral-200 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Anti-Cheat Mode</span>
                <span className="text-xl font-extrabold text-green-600 uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" /> Active
                </span>
                <span className="text-xs text-neutral-400 font-semibold">Enforcing Security Constraints</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-black mb-4 flex items-center gap-2">
                <span>⚡</span> Super Admin Direct Controls
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setEditingAdmin({ username: "", password: "", fullName: "", email: "", department: "CSBS", role: "admin", permissions: ["view_participants"] });
                    setShowAdminModal(true);
                  }}
                  className="p-4 rounded-xl border-2 border-neutral-200 hover:border-black text-left font-bold text-sm transition-all bg-stone-50 hover:bg-white"
                >
                  <div className="text-xl mb-1">👤</div>
                  <div className="text-black font-extrabold">Create New Admin Account</div>
                  <div className="text-xs text-neutral-500 mt-1">Assign custom permissions & credentials</div>
                </button>

                <button
                  onClick={() => router.push("/admin/portal?tab=rounds")}
                  className="p-4 rounded-xl border-2 border-neutral-200 hover:border-black text-left font-bold text-sm transition-all bg-stone-50 hover:bg-white"
                >
                  <div className="text-xl mb-1">🏁</div>
                  <div className="text-black font-extrabold">Dynamic Round Manager</div>
                  <div className="text-xs text-neutral-500 mt-1">Add, edit, reorder, or enable rounds</div>
                </button>

                <button
                  onClick={() => router.push("/admin/portal?tab=backup")}
                  className="p-4 rounded-xl border-2 border-neutral-200 hover:border-black text-left font-bold text-sm transition-all bg-stone-50 hover:bg-white"
                >
                  <div className="text-xl mb-1">💾</div>
                  <div className="text-black font-extrabold">Full System Backup</div>
                  <div className="text-xs text-neutral-500 mt-1">Download entire portal database backup</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: ADMIN ACCOUNTS & ROLES ── */}
        {(activeTab === "overview" || activeTab === "admins") && (
          <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-black flex items-center gap-2">
                  <span>🛡️</span> Administrator Accounts & Role Matrix
                </h2>
                <p className="text-xs text-neutral-500">Super Admins have full system control. Admins have custom assigned permissions.</p>
              </div>
              <button
                onClick={() => {
                  setEditingAdmin({ username: "", password: "", fullName: "", email: "", department: "CSBS", role: "admin", permissions: ["view_participants"] });
                  setShowAdminModal(true);
                }}
                className="bg-black text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all"
              >
                + Add New Admin
              </button>
            </div>

            <div className="space-y-3">
              {admins.map((adm) => (
                <div key={adm.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border-2 border-neutral-200 hover:border-black transition-all">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-extrabold text-black">{adm.fullName || adm.username}</span>
                      <span className="text-neutral-400 text-xs">@{adm.username}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                        adm.role === "super_admin" ? "bg-black text-white" : "bg-zinc-100 text-black border border-neutral-200"
                      }`}>
                        {adm.role === "super_admin" ? "👑 SUPER ADMIN" : "ADMIN"}
                      </span>
                      {adm.isLocked && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-600">LOCKED</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {adm.role === "super_admin" ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-black">⚡ Implicit Full Access</span>
                      ) : (adm.permissions || []).map((pKey: string) => (
                        <span key={pKey} className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-neutral-700 border border-neutral-200">
                          ✓ {pKey}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingAdmin({
                          id: adm.id,
                          username: adm.username,
                          fullName: adm.fullName,
                          email: adm.email,
                          department: adm.department,
                          role: adm.role,
                          permissions: adm.permissions || [],
                        });
                        setShowAdminModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                    >
                      Edit Roles
                    </button>
                    {adm.role !== "super_admin" && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete admin '${adm.username}'?`)) return;
                          const res = await fetch(`${API_BASE}/api/admin/management/${adm.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.ok) {
                            showToast("Admin account deleted.");
                            fetchData();
                          } else showToast("Failed to delete admin.", "error");
                        }}
                        className="px-3 py-1.5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: PORTAL & EVENT CONTROL ── */}
        {activeTab === "portal" && (
          <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-black flex items-center gap-2">
              <span>🏛️</span> Complete Portal Configuration
            </h2>
            <p className="text-sm text-neutral-500">Configure event branding, department titles, symposium names, and theme colors directly from Portal Management.</p>
            <button
              onClick={() => router.push("/admin/portal")}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all"
            >
              Open Full Portal Management Page →
            </button>
          </div>
        )}

        {/* ── TAB: DYNAMIC ROUNDS ── */}
        {activeTab === "rounds" && (
          <DynamicRoundsTab token={token} router={router} showToast={showToast} />
        )}

        {/* ── TAB: SECURITY & ANTI-CHEAT ── */}
        {activeTab === "security" && (
          <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-black flex items-center gap-2">
              <span>🔒</span> Security & Anti-Cheat Control Panel
            </h2>
            <p className="text-sm text-neutral-500">Configure fullscreen requirement, tab switching detection, copy/paste restriction, and automated violation submissions.</p>
            <button
              onClick={() => router.push("/admin/security")}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all"
            >
              Open Security & Audit Control Panel →
            </button>
          </div>
        )}

        {/* ── TAB: ACTIVITY AUDIT LOG ── */}
        {activeTab === "logs" && (
          <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-black flex items-center gap-2">
              <span>📜</span> System Activity Audit Log
            </h2>
            <p className="text-xs text-neutral-500">Chronological history of admin and user actions in the system.</p>
            <div className="max-h-96 overflow-y-auto border-2 border-neutral-200 rounded-xl divide-y divide-neutral-100">
              {activityLogs.length === 0 ? (
                <div className="p-6 text-center text-neutral-400 text-xs font-bold">No activity logs recorded yet.</div>
              ) : (
                activityLogs.slice(0, 50).map((log, idx) => (
                  <div key={idx} className="p-3 text-xs flex justify-between items-center gap-4 hover:bg-stone-50">
                    <div>
                      <span className="font-extrabold text-black mr-2">[{log.action || "ACTION"}]</span>
                      <span className="text-neutral-600">{JSON.stringify(log.details || {})}</span>
                    </div>
                    <span className="text-neutral-400 font-mono text-[11px] shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Admin User Creation / Edit Modal ── */}
      <AnimatePresence>
        {showAdminModal && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAdminModal(false); }}
          >
            <motion.div
              className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-xl font-extrabold text-black">
                  {editingAdmin.id ? "Edit Admin & Permissions" : "Create New Admin User"}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-neutral-500">Username</label>
                    <input type="text" value={editingAdmin.username} onChange={(e) => setEditingAdmin((a) => ({ ...a, username: e.target.value }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-neutral-500">{editingAdmin.id ? "New Password (optional)" : "Password"}</label>
                    <input type="password" value={editingAdmin.password || ""} onChange={(e) => setEditingAdmin((a) => ({ ...a, password: e.target.value }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-neutral-500">Full Name</label>
                    <input type="text" value={editingAdmin.fullName} onChange={(e) => setEditingAdmin((a) => ({ ...a, fullName: e.target.value }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-neutral-500">Email Address</label>
                    <input type="email" value={editingAdmin.email} onChange={(e) => setEditingAdmin((a) => ({ ...a, email: e.target.value }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-neutral-500">System Role</label>
                  <select
                    value={editingAdmin.role}
                    onChange={(e) => setEditingAdmin((a) => ({ ...a, role: e.target.value as any }))}
                    className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none"
                  >
                    <option value="admin">Admin (Granular Permissions)</option>
                    <option value="super_admin">👑 Super Admin (Full Authority)</option>
                  </select>
                </div>

                {editingAdmin.role === "admin" && (
                  <div className="border-t border-neutral-100 pt-4 space-y-2">
                    <p className="text-xs font-bold uppercase text-neutral-500 mb-2">Assigned Permissions Matrix</p>
                    {(availablePermissions.length > 0 ? availablePermissions : [
                      { key: "view_participants", label: "View Participants & Results" },
                      { key: "manage_participants", label: "Manage Participants (Create, Edit, Delete, Reset)" },
                      { key: "start_stop_rounds", label: "Start & Stop Competition Rounds" },
                      { key: "manage_questions", label: "Manage Questions (MCQ, Coding, Debug)" },
                      { key: "generate_reports", label: "Generate & Export Reports" },
                      { key: "publish_leaderboard", label: "Publish & Hide Leaderboards" },
                      { key: "manage_security", label: "Manage Anti-Cheat & Security Settings" },
                      { key: "portal_settings", label: "Manage Portal Branding & Configuration" },
                    ]).map((perm: any) => {
                      const isChecked = editingAdmin.permissions.includes(perm.key);
                      return (
                        <label key={perm.key} className="flex items-center gap-3 p-2.5 rounded-xl border border-neutral-200 hover:border-black cursor-pointer text-xs font-bold text-black transition-all">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingAdmin((a) => ({ ...a, permissions: [...a.permissions, perm.key] }));
                              } else {
                                setEditingAdmin((a) => ({ ...a, permissions: a.permissions.filter((k) => k !== perm.key) }));
                              }
                            }}
                            className="w-4 h-4 rounded accent-black cursor-pointer"
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="px-5 py-2 rounded-xl border-2 border-neutral-200 hover:border-black font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editingAdmin.username) { showToast("Username is required.", "error"); return; }
                    if (!editingAdmin.id && !editingAdmin.password) { showToast("Password is required.", "error"); return; }
                    setSavingAdmin(true);
                    try {
                      const isEdit = !!editingAdmin.id;
                      const url = isEdit ? `${API_BASE}/api/admin/management/${editingAdmin.id}` : `${API_BASE}/api/admin/management`;
                      const method = isEdit ? "PUT" : "POST";
                      const res = await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify(editingAdmin),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || "Failed");
                      }
                      showToast(`Admin account ${isEdit ? "updated" : "created"} successfully.`);
                      setShowAdminModal(false);
                      fetchData();
                    } catch (err: any) {
                      showToast(err.message || "Failed to save admin.", "error");
                    } finally { setSavingAdmin(false); }
                  }}
                  disabled={savingAdmin}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {savingAdmin && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editingAdmin.id ? "Save Changes" : "Create Admin Account"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
