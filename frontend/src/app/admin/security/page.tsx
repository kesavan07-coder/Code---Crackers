"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { usePortal } from "@/lib/portalContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface CompetitionSettings {
  fullscreenModeEnabled: boolean;
  rightClickBlocked: boolean;
  copyPasteRestricted: boolean;
  keyboardShortcutsBlocked: boolean;
  devToolsDetectionEnabled: boolean;
  tabSwitchDetectionEnabled: boolean;
  autoSubmitOnTabSwitch: boolean;
  autoSubmitOnFullscreenExit: boolean;
  singleDeviceLoginEnabled: boolean;
  autoSaveIntervalSeconds: number;
  timerMode: "global" | "individual";
  announcement: string | null;
  broadcastMessage: string | null;
  resultsPublished: boolean;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  metadata: any;
}

function AdminNav({ active }: { active: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { portalSettings } = usePortal();
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

export default function SecurityPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<CompetitionSettings | null>(null);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [announcementText, setAnnouncementText] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSettingsAndLogs = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      const settingsRes = await fetch(`${API_BASE}/api/competition/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }

      const logsRes = await fetch(`${API_BASE}/api/admin/participants/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin" && user.role !== "super_admin") { router.replace("/dashboard"); return; }
    fetchSettingsAndLogs();

    const interval = setInterval(() => fetchSettingsAndLogs(true), 5000);
    return () => clearInterval(interval);
  }, [token, user, router, fetchSettingsAndLogs]);

  const updateSetting = async (key: keyof CompetitionSettings, value: any) => {
    if (!token || !settings) return;
    const updated = { ...settings, [key]: value };
    // Optimistic update
    setSettings(updated);

    try {
      const res = await fetch(`${API_BASE}/api/competition/settings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        throw new Error();
      }
      showToast("Setting updated successfully.");
    } catch {
      showToast("Failed to update setting.", "error");
      fetchSettingsAndLogs(); // revert
    }
  };

  const handleAnnouncementSubmit = async () => {
    if (!token) return;
    setActionLoading("announcement");
    try {
      const res = await fetch(`${API_BASE}/api/competition/announcement`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ announcement: announcementText.trim() || null }),
      });
      if (res.ok) {
        showToast(announcementText.trim() ? "Announcement published." : "Announcement cleared.");
        setAnnouncementText("");
        fetchSettingsAndLogs();
      } else {
        showToast("Failed to publish announcement.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBroadcastSubmit = async () => {
    if (!token) return;
    setActionLoading("broadcast");
    try {
      const res = await fetch(`${API_BASE}/api/competition/broadcast`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: broadcastText.trim() || null }),
      });
      if (res.ok) {
        showToast(broadcastText.trim() ? "Message broadcasted." : "Broadcast cleared.");
        setBroadcastText("");
        fetchSettingsAndLogs();
      } else {
        showToast("Failed to broadcast message.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const clearSubmissions = async () => {
    if (!token) return;
    if (!confirm("Are you absolutely sure you want to delete all submissions? This will clear MCQ answers, coding outputs, and debug logs permanently!")) return;
    setActionLoading("clearSubmissions");
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/reset-submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("All submissions cleared successfully.");
      } else {
        showToast("Failed to clear submissions.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.username.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      JSON.stringify(log.metadata).toLowerCase().includes(query)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  // Compute violations from logs
  const violations = logs.filter(l => l.action === "VIOLATION");
  const violationCounts: Record<string, number> = {};
  violations.forEach(v => {
    const uname = v.metadata?.username || v.username;
    violationCounts[uname] = (violationCounts[uname] || 0) + 1;
  });

  const getViolationSeverityStyle = (type: string) => {
    if (["FULLSCREEN_EXIT", "DEVTOOLS_ATTEMPT"].includes(type)) return "bg-red-100 text-red-700 border-red-200";
    if (["TAB_SWITCH", "COPY_ATTEMPT", "PASTE_ATTEMPT", "CUT_ATTEMPT", "RIGHT_CLICK"].includes(type)) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-zinc-100 text-neutral-600 border-neutral-200";
  };

  const generateViolationsPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const now = new Date();

      // Header
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Muthayammal Engineering College (Autonomous)", 14, 12);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text("Rasipuram, Namakkal – 637 408 | Dept. of Computer Science & Business Systems (CSBS)", 14, 17);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("NEXUS'26 Symposium – Code Crackers | Anti-Cheating Violations Audit Report", 14, 24);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`Generated: ${now.toLocaleDateString("en-IN")} at ${now.toLocaleTimeString("en-IN")}  |  Total Violations Detected: ${violations.length}`, 14, 30);

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(14, 33, doc.internal.pageSize.width - 14, 33);

      const tableHead = [["S.No", "Username", "Violation Type", "Round", "Date & Time", "Details"]];
      const tableBody = [...violations].reverse().map((v, idx) => [
        idx + 1,
        v.metadata?.username || v.username,
        v.metadata?.type || "UNKNOWN",
        `Round ${v.metadata?.round || "?"}`,
        new Date(v.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
        v.metadata?.details || "—",
      ]);

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 37,
        styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.3 },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 40, fontStyle: "bold" },
          2: { cellWidth: 45, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { cellWidth: 50 },
          5: { cellWidth: 100 },
        },
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(
          `MEC CSBS – NEXUS'26 – Code Crackers  |  Anti-Cheat Security Audit  |  Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: "center" }
        );
      }

      doc.save(`Anti_Cheat_Violations_Report_${now.toISOString().slice(0, 10)}.pdf`);
      showToast("Anti-Cheat Violations PDF report downloaded.");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate Anti-Cheat PDF.", "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* Toast Alert */}
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

      <AdminNav active="/admin/security" />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-12 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">

        {/* Anti-Cheat Violations Section */}
        <div className="bg-white rounded-2xl p-5 sm:p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-extrabold text-black">Anti-Cheat Violations</h2>
            <div className="flex items-center gap-3">
              {violations.length > 0 && (
                <button
                  onClick={generateViolationsPDF}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold border-2 border-neutral-200 bg-white hover:border-black transition-colors cursor-pointer flex items-center gap-2 text-black"
                >
                  📄 Export PDF Report
                </button>
              )}
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border-2 ${violations.length > 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-zinc-100 text-neutral-500 border-neutral-200"}`}>
                {violations.length} Violation{violations.length !== 1 ? "s" : ""} Detected
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Live log of anti-cheat events across all rounds</p>

          {violations.length === 0 ? (
            <div className="border-2 border-dashed border-neutral-200 rounded-2xl py-12 text-center">
              <span className="text-3xl block mb-3">🛡️</span>
              <p className="text-sm font-bold text-neutral-400">No violations detected yet.</p>
              <p className="text-xs text-neutral-300 font-semibold mt-1">Violations will appear here when participants trigger anti-cheat events.</p>
            </div>
          ) : (
            <>
              {/* Per-participant summary */}
              {Object.entries(violationCounts).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {Object.entries(violationCounts).sort((a, b) => b[1] - a[1]).map(([username, count]) => (
                    <span key={username} className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 ${count >= 3 ? "bg-red-100 text-red-700 border-red-200" : count >= 2 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-zinc-100 text-neutral-600 border-neutral-200"}`}>
                      {username}: {count} violation{count !== 1 ? "s" : ""}
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border-2 border-neutral-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-zinc-50">
                      <th className="text-left font-bold uppercase tracking-widest text-neutral-500 px-4 py-3">Username</th>
                      <th className="text-left font-bold uppercase tracking-widest text-neutral-500 px-4 py-3">Violation Type</th>
                      <th className="text-left font-bold uppercase tracking-widest text-neutral-500 px-4 py-3">Round</th>
                      <th className="text-left font-bold uppercase tracking-widest text-neutral-500 px-4 py-3">Date & Time</th>
                      <th className="text-left font-bold uppercase tracking-widest text-neutral-500 px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...violations].reverse().map((v) => (
                      <tr key={v.id} className="border-b border-neutral-50 hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-extrabold text-black">{v.metadata?.username || v.username}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${getViolationSeverityStyle(v.metadata?.type || "")}`}>
                            {v.metadata?.type || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-600">Round {v.metadata?.round || "?"}</td>
                        <td className="px-4 py-3 text-neutral-500 font-semibold">
                          {new Date(v.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </td>
                        <td className="px-4 py-3 text-neutral-400 max-w-xs truncate">{v.metadata?.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Security Policy Settings */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Security Toggles Card */}
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <h2 className="text-xl font-extrabold text-black mb-1">Environment Security Toggles</h2>
            <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Configure student testing restrictions</p>
            
            <div className="flex flex-col gap-6">
              {[
                {
                  key: "fullscreenModeEnabled",
                  label: "Force Fullscreen Mode",
                  desc: "Forces candidates to test in fullscreen mode. Exiting prompts warning / auto-submit."
                },
                {
                  key: "rightClickBlocked",
                  label: "Block Right-Click Menu",
                  desc: "Disables mouse right-click interactions inside the workspace."
                },
                {
                  key: "copyPasteRestricted",
                  label: "Restrict Copy-Paste",
                  desc: "Prevents pasting into code/MCQ fields and copying question descriptions."
                },
                {
                  key: "keyboardShortcutsBlocked",
                  label: "Block Developer Keys",
                  desc: "Disables standard shortcuts like Ctrl+C, Ctrl+V, F12, Ctrl+Shift+I."
                },
                {
                  key: "devToolsDetectionEnabled",
                  label: "Detect Developer Tools",
                  desc: "Actively listens for console openings and logs immediate violations."
                },
                {
                  key: "tabSwitchDetectionEnabled",
                  label: "Monitor Tab Switching",
                  desc: "Registers whenever the participant switches applications or windows."
                },
                {
                  key: "autoSubmitOnTabSwitch",
                  label: "Auto-Submit on Tab Switch",
                  desc: "Automatically locks and submits active round answers if a tab-switch occurs."
                },
                {
                  key: "autoSubmitOnFullscreenExit",
                  label: "Auto-Submit on Fullscreen Exit",
                  desc: "Automatically locks and submits active round if participant leaves fullscreen."
                },
                {
                  key: "singleDeviceLoginEnabled",
                  label: "Single-Device Enforcement",
                  desc: "Logs out any previous session immediately when the credentials are used elsewhere."
                },
              ].map((policy) => {
                const checked = settings ? (settings[policy.key as keyof CompetitionSettings] as boolean) : false;
                return (
                  <div key={policy.key} className="flex items-start justify-between gap-6 pb-5 border-b border-neutral-100 last:border-b-0 last:pb-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-extrabold text-black">{policy.label}</span>
                      <span className="text-xs text-neutral-500 leading-relaxed max-w-lg">{policy.desc}</span>
                    </div>
                    
                    <button
                      onClick={() => updateSetting(policy.key as keyof CompetitionSettings, !checked)}
                      className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex-shrink-0 cursor-pointer ${checked ? 'bg-black' : 'bg-neutral-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Settings Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <h2 className="text-xl font-extrabold text-black mb-1">Global Configuration Parameters</h2>
            <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Sync intervals and timers</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Timer Mode */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Timer Mode</label>
                <select
                  value={settings?.timerMode || "global"}
                  onChange={(e) => updateSetting("timerMode", e.target.value as "global" | "individual")}
                  className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                >
                  <option value="global">Global (All sync to admin timer)</option>
                  <option value="individual">Individual (Relative to student start)</option>
                </select>
              </div>

              {/* Auto Save Interval */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Auto-Save Interval</label>
                <select
                  value={settings?.autoSaveIntervalSeconds || 30}
                  onChange={(e) => updateSetting("autoSaveIntervalSeconds", Number(e.target.value))}
                  className="px-4 py-3 rounded-xl text-sm font-bold text-black bg-zinc-50 border-2 border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
                >
                  <option value={10}>10 Seconds</option>
                  <option value={30}>30 Seconds</option>
                  <option value={60}>60 Seconds</option>
                  <option value={120}>2 Minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-black">Permanent Activity Logs</h2>
                <p className="text-xs font-semibold text-neutral-500 mt-1 uppercase tracking-wider">Real-time system audit logs</p>
              </div>

              <input
                type="text"
                placeholder="Filter logs by keyword…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 text-xs font-bold bg-zinc-50 border-2 border-neutral-200 rounded-xl text-black placeholder-neutral-400 focus:outline-none focus:border-black"
              />
            </div>

            {logsLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                No activity logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-neutral-500 w-32">Timestamp</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-neutral-500 w-36">User</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-neutral-500 w-44">Action</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">Details / Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredLogs.slice(0, 100).map((log) => (
                      <tr key={log.id} className="text-xs hover:bg-stone-50 transition-colors">
                        <td className="py-3.5 font-semibold text-neutral-400 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="py-3.5 font-bold text-black">{log.username}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wide ${
                            log.action.includes("LOCK") || log.action.includes("REJECT") || log.action.includes("DISABLE")
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : log.action.includes("START") || log.action.includes("APPROVE")
                              ? "bg-black text-white"
                              : "bg-zinc-100 text-neutral-600"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-neutral-500 max-w-xs truncate">
                          {JSON.stringify(log.metadata)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Communications & Actions */}
        <div className="flex flex-col gap-8">
          
          {/* Announcement Dispatcher */}
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <h2 className="text-lg font-extrabold text-black mb-1">Host Announcement</h2>
            <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Pinned message in Waiting Room</p>

            {settings?.announcement && (
              <div className="bg-zinc-50 border-2 border-neutral-200 rounded-xl p-4 mb-4 text-xs font-semibold text-black relative">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Active Pinned:</span>
                "{settings.announcement}"
                <button
                  onClick={() => { setAnnouncementText(""); updateSetting("announcement", null); }}
                  className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 font-extrabold"
                  title="Clear Pinned"
                >
                  ✕
                </button>
              </div>
            )}

            <textarea
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              rows={3}
              placeholder="Type persistent announcement details here…"
              className="w-full px-4 py-3 rounded-xl text-xs font-semibold bg-zinc-50 border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black resize-none"
            />
            
            <button
              onClick={handleAnnouncementSubmit}
              disabled={actionLoading === "announcement"}
              className="w-full mt-3 py-3 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {actionLoading === "announcement" ? "Publishing…" : "Publish Announcement"}
            </button>
          </div>

          {/* Broadcast Message Dispatcher */}
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <h2 className="text-lg font-extrabold text-black mb-1">Broadcast Banner Alert</h2>
            <p className="text-xs font-semibold text-neutral-500 mb-6 uppercase tracking-wider">Instant alert across all pages</p>

            {settings?.broadcastMessage && (
              <div className="bg-black text-white border-2 border-black rounded-xl p-4 mb-4 text-xs font-bold relative">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Active Broadcast:</span>
                "{settings.broadcastMessage}"
                <button
                  onClick={() => { setBroadcastText(""); updateSetting("broadcastMessage", null); }}
                  className="absolute top-2 right-2 text-neutral-400 hover:text-red-400 font-extrabold"
                  title="Clear Broadcast"
                >
                  ✕
                </button>
              </div>
            )}

            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              rows={3}
              placeholder="Type urgent banner alert message here…"
              className="w-full px-4 py-3 rounded-xl text-xs font-semibold bg-zinc-50 border-2 border-neutral-200 text-black placeholder-neutral-400 focus:outline-none focus:border-black resize-none"
            />

            <button
              onClick={handleBroadcastSubmit}
              disabled={actionLoading === "broadcast"}
              className="w-full mt-3 py-3 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-40"
            >
              {actionLoading === "broadcast" ? "Broadcasting…" : "Broadcast Banner"}
            </button>
          </div>

          {/* Dangerous Operations */}
          <div className="bg-white rounded-2xl p-8 border border-red-200 shadow-[0_4px_20px_rgb(220,38,38,0.02)]">
            <h2 className="text-lg font-extrabold text-red-600 mb-1">Danger Zone</h2>
            <p className="text-xs font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Destructive administration actions</p>

            <button
              onClick={clearSubmissions}
              disabled={actionLoading === "clearSubmissions"}
              className="w-full py-4 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
            >
              {actionLoading === "clearSubmissions" ? "Clearing…" : "✕ Reset All Submissions"}
            </button>
            <p className="text-[10px] text-neutral-400 mt-2 text-center leading-relaxed">
              This action deletes all student submissions for Round 1, 2, and 3. Ensure scores are exported before executing.
            </p>
          </div>

        </div>

        </div>

      </main>
    </div>
  );
}
