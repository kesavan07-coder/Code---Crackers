"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { usePortal } from "@/lib/portalContext";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ── Types ──────────────────────────────────────────────────────────────
interface PortalSettings {
  eventName: string;
  eventSubtitle: string;
  collegeName: string;
  collegeLogo?: string;
  departmentName: string;
  departmentLogo?: string;
  symposiumName: string;
  academicYear?: string;
  eventDate: string;
  venue: string;
  coordinatorName: string;
  hodName: string;
  principalName?: string;
  contactNumber?: string;
  emailAddress?: string;
  website?: string;
  address?: string;
  contactDetails: string;
  browserTitle: string;
  themeColor: string;
  messages: {
    waitingForEvaluation: string;
    roundStarted: string;
    roundCompleted: string;
    qualified: string;
    eliminated: string;
    countdownMessage: string;
    submissionSuccessful: string;
    sessionExpired: string;
    fullscreenWarning: string;
    tabSwitchWarning: string;
  };
  leaderboardShowScore: boolean;
  leaderboardShowTimeTaken: boolean;
  leaderboardShowCollege: boolean;
  leaderboardShowDepartment: boolean;
  leaderboardRankingMethod: "score_then_time" | "score_only";
}

interface AppearanceSettings {
  themeColor: string;
  backgroundColor: string;
  buttonColor: string;
  fontStyle: string;
  loginBannerText: string;
  loadingScreenMessage: string;
  footerText: string;
  showAnimations: boolean;
  showCollegeLogo: boolean;
}

interface ReportSettings {
  reportTitle: string;
  reportSubtitle: string;
  reportFooter: string;
  reportTextColor: string;
  reportHeaderBgColor: string;
  reportTheme: "default" | "professional" | "minimal" | "colorful";
  includeCollegeLogo: boolean;
  includeCoordinatorSignature: boolean;
  includeHodSignature: boolean;
  showRank: boolean;
  showScore: boolean;
  showTimeTaken: boolean;
  showDepartment: boolean;
  showCollege: boolean;
}

interface SecuritySettings {
  fullscreenModeEnabled: boolean;
  rightClickBlocked: boolean;
  copyPasteRestricted: boolean;
  keyboardShortcutsBlocked: boolean;
  devToolsDetectionEnabled: boolean;
  tabSwitchDetectionEnabled: boolean;
  autoSubmitOnTabSwitch: boolean;
  autoSubmitOnFullscreenExit: boolean;
  singleDeviceLoginEnabled: boolean;
}

interface DynamicRound {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "mcq" | "coding" | "bug_hunter" | "rapid_fire" | "manual" | "aptitude" | "sql" | "output_prediction" | "fill_blanks" | "file_upload" | "viva" | "ai_challenge" | "cyber_security" | "web_dev" | "mobile_dev" | "ctf" | "custom";
  order: number;
  timeLimit: number;
  countdownDuration: number;
  maxScore: number;
  passingScore: number;
  enabled: boolean;
  leaderboardEnabled: boolean;
  antiCheatEnabled: boolean;
  fullscreenRequired: boolean;
  tabDetectionEnabled: boolean;
  copyProtectionEnabled: boolean;
  autoSubmitOnTimeout: boolean;
  autoSubmitOnViolation: boolean;
  allowResubmission: boolean;
}

interface PublishedLeaderboards { [round: string]: boolean; }

// ── Nav ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Participants", href: "/admin/participants" },
  { label: "Questions", href: "/admin/questions" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Portal", href: "/admin/portal" },
];

function AdminNav({ logout }: { logout: () => void }) {
  const router = useRouter();
  const { portalSettings } = usePortal();
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {portalSettings.collegeLogo ? (
            <img
              src={portalSettings.collegeLogo}
              alt={portalSettings.collegeName || "College Logo"}
              className="w-9 h-9 object-contain rounded-xl border border-neutral-200 p-0.5 bg-white"
            />
          ) : (
            <div className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center font-extrabold text-sm select-none">CC</div>
          )}
          <span className="font-extrabold text-base tracking-tight text-black hidden sm:block">{portalSettings.eventName || "Code Crackers"}</span>
          <span className="text-neutral-300 hidden sm:block">|</span>
          <span className="text-xs font-bold tracking-widest uppercase text-neutral-500 hidden sm:block">Portal Management</span>
        </div>
        <nav className="flex items-center gap-1 flex-wrap">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.href}
              onClick={() => router.push(n.href)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase border-2 transition-all ${
                n.href === "/admin/portal"
                  ? "bg-black text-white border-black"
                  : "text-neutral-500 border-transparent hover:border-neutral-200"
              }`}
            >
              {n.label}
            </button>
          ))}
          <button
            onClick={logout}
            className="ml-2 text-xs font-bold text-neutral-400 hover:text-red-500 transition-colors px-2"
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

// ── Toggle Switch ──────────────────────────────────────────────────────
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer group">
      <span className="text-sm font-semibold text-black group-hover:text-neutral-700 transition-colors">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 ${
          value ? "bg-black" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

// ── Section Header ─────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-extrabold text-black">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-neutral-500 ml-8">{subtitle}</p>}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none transition-all"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none transition-all resize-none"
      />
    </div>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────────────
const TABS = [
  { id: "general", label: "General Info", icon: "🏛️" },
  { id: "rounds", label: "Round Settings", icon: "🔄" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "messages", label: "Messages", icon: "💬" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
  { id: "appearance", label: "Appearance", icon: "🎨" },
  { id: "participants", label: "Participants", icon: "👥" },
  { id: "reports", label: "Reports", icon: "📊" },
  { id: "admins", label: "Admin & Roles", icon: "🛡️" },
  { id: "backup", label: "Backup & Restore", icon: "💾" },
];

// ── Main Component ─────────────────────────────────────────────────────
export default function PortalManagementPage() {
  const { token, isLoading: authLoading, logout } = useAuth();
  const { refreshPortalInfo } = usePortal();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Deep-link support: ?tab=rounds etc.
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const [portalSettings, setPortalSettings] = useState<PortalSettings>({
    eventName: "Code Crackers",
    eventSubtitle: "Technical Quiz Competition",
    collegeName: "Muthayammal Engineering College (Autonomous)",
    collegeLogo: "/college_logo.png",
    departmentName: "Department of Computer Science & Business Systems",
    departmentLogo: "",
    symposiumName: "NEXUS'26",
    academicYear: "2025 - 2026",
    eventDate: "",
    venue: "",
    coordinatorName: "",
    hodName: "",
    principalName: "",
    contactNumber: "",
    emailAddress: "",
    website: "",
    address: "",
    contactDetails: "",
    browserTitle: "Code Crackers – NEXUS'26",
    themeColor: "#000000",
    messages: {
      waitingForEvaluation: "Your submission has been received. Please wait while organizers evaluate all participants.",
      roundStarted: "Round has started! Good luck!",
      roundCompleted: "You have completed this round. Waiting for results.",
      qualified: "Congratulations! You have qualified for the next round.",
      eliminated: "Thank you for participating. Better luck next time!",
      countdownMessage: "Get Ready! The round is about to begin.",
      submissionSuccessful: "Your answers have been submitted successfully.",
      sessionExpired: "Your session has expired. Please log in again.",
      fullscreenWarning: "Please remain in fullscreen mode during the competition.",
      tabSwitchWarning: "Tab switching detected! Please stay on the competition page.",
    },
    leaderboardShowScore: true,
    leaderboardShowTimeTaken: true,
    leaderboardShowCollege: true,
    leaderboardShowDepartment: true,
    leaderboardRankingMethod: "score_then_time",
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    fullscreenModeEnabled: false,
    rightClickBlocked: false,
    copyPasteRestricted: false,
    keyboardShortcutsBlocked: false,
    devToolsDetectionEnabled: false,
    tabSwitchDetectionEnabled: false,
    autoSubmitOnTabSwitch: false,
    autoSubmitOnFullscreenExit: false,
    singleDeviceLoginEnabled: true,
  });

  const [roundDurations, setRoundDurations] = useState<Record<number, number>>({ 1: 30, 2: 45, 3: 20 });
  const [publishedLeaderboards, setPublishedLeaderboards] = useState<PublishedLeaderboards>({
    "1": false, "2": false, "3": false, "overall": false,
  });
  const [dynamicRounds, setDynamicRounds] = useState<DynamicRound[]>([]);
  const [showRoundModal, setShowRoundModal] = useState(false);

  const [appearance, setAppearance] = useState<AppearanceSettings>({
    themeColor: "#000000",
    backgroundColor: "#f5f5f4",
    buttonColor: "#000000",
    fontStyle: "Inter",
    loginBannerText: "Welcome to Code Crackers Technical Quiz",
    loadingScreenMessage: "Loading Code Crackers...",
    footerText: "Code Crackers – NEXUS'26 | Department of CSBS",
    showAnimations: true,
    showCollegeLogo: true,
  });

  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    reportTitle: "Code Crackers Technical Quiz Report",
    reportSubtitle: "NEXUS'26 | Department of Computer Science & Business Systems",
    reportFooter: "Muthayammal Engineering College (Autonomous) | NEXUS'26",
    reportTextColor: "#000000",
    reportHeaderBgColor: "#000000",
    reportTheme: "professional",
    includeCollegeLogo: true,
    includeCoordinatorSignature: true,
    includeHodSignature: true,
    showRank: true,
    showScore: true,
    showTimeTaken: true,
    showDepartment: true,
    showCollege: true,
  });

  // Participant bulk operation state
  const [participantOp, setParticipantOp] = useState<{
    generating: boolean;
    count: number;
    prefix: string;
    department: string;
    college: string;
    generatedResult: { username: string; password: string }[] | null;
  }>({
    generating: false, count: 30, prefix: "CC", department: "CSBS",
    college: "Muthayammal Engineering College (Autonomous)", generatedResult: null,
  });
  // Admin Management state
  const [admins, setAdmins] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
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

  const fetchAdmins = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/management`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
        setAvailablePermissions(data.availablePermissions || []);
      }
    } catch {}
  }, [token]);

  const [editingRound, setEditingRound] = useState<Partial<DynamicRound> | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  };

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/portal/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.portalSettings) setPortalSettings(data.portalSettings);
      if (data.securitySettings) setSecurity(data.securitySettings);
      if (data.roundDurations) {
        const rd: Record<number, number> = {};
        Object.entries(data.roundDurations).forEach(([k, v]) => { rd[Number(k)] = Number(v); });
        setRoundDurations(rd);
      }
      if (data.publishedLeaderboards) setPublishedLeaderboards(data.publishedLeaderboards);
      if (data.dynamicRounds) setDynamicRounds(data.dynamicRounds);
      await fetchAdmins();
    } catch {
      showToast("Failed to load portal settings.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.replace("/login"); return; }
    fetchSettings();
  }, [authLoading, token, router, fetchSettings]);

  // ── Save Portal Settings ─────────────────────────────────────────────
  const savePortalSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(portalSettings),
      });
      if (!res.ok) throw new Error();
      showToast("Portal settings saved successfully.");
      await refreshPortalInfo();
    } catch {
      showToast("Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Save Security ────────────────────────────────────────────────────
  const saveSecurity = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/security`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(security),
      });
      if (!res.ok) throw new Error();
      showToast("Security settings saved.");
      await refreshPortalInfo();
    } catch {
      showToast("Failed to save security settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Save Round Durations ─────────────────────────────────────────────
  const saveRoundDurations = async () => {
    setSaving(true);
    try {
      const patches: Record<string, number> = {};
      Object.entries(roundDurations).forEach(([k, v]) => { patches[k] = v; });
      const res = await fetch(`${API_BASE}/api/portal/round-durations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patches),
      });
      if (!res.ok) throw new Error();
      showToast("Round durations saved.");
      await refreshPortalInfo();
    } catch {
      showToast("Failed to save round durations.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle Leaderboard Publish ───────────────────────────────────────
  const toggleLeaderboard = async (round: string, published: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/competition/leaderboard/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ round, published }),
      });
      if (!res.ok) throw new Error();
      setPublishedLeaderboards((p) => ({ ...p, [round]: published }));
      showToast(`Leaderboard Round ${round} ${published ? "published" : "hidden"}.`);
    } catch {
      showToast("Failed to update leaderboard.", "error");
    }
  };

  // ── Dynamic Round CRUD ───────────────────────────────────────────────
  const openNewRound = () => {
    setEditingRound({
      name: "", description: "", icon: "🏁", type: "mcq", timeLimit: 30,
      countdownDuration: 10, maxScore: 100, passingScore: 50,
      enabled: true, leaderboardEnabled: true, antiCheatEnabled: true,
      fullscreenRequired: false, tabDetectionEnabled: false,
      copyProtectionEnabled: false, autoSubmitOnTimeout: true,
      autoSubmitOnViolation: false, allowResubmission: false,
    });
    setShowRoundModal(true);
  };

  const openEditRound = (r: DynamicRound) => {
    setEditingRound({ ...r });
    setShowRoundModal(true);
  };

  const saveRound = async () => {
    if (!editingRound) return;
    setSaving(true);
    try {
      const isEdit = !!(editingRound as DynamicRound).id;
      const url = isEdit
        ? `${API_BASE}/api/portal/rounds/${(editingRound as DynamicRound).id}`
        : `${API_BASE}/api/portal/rounds`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingRound),
      });
      if (!res.ok) throw new Error();
      showToast(`Round ${isEdit ? "updated" : "created"} successfully.`);
      setShowRoundModal(false);
      setEditingRound(null);
      await fetchSettings();
      await refreshPortalInfo();
    } catch {
      showToast("Failed to save round.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteRound = async (id: string) => {
    if (!confirm("Delete this round? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/portal/rounds/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast("Round deleted.");
      await fetchSettings();
      await refreshPortalInfo();
    } catch {
      showToast("Failed to delete round.", "error");
    }
  };

  // ── AI Round Draft Generator ─────────────────────────────────────────
  const generateAIDraft = async () => {
    if (!aiPrompt.trim()) { showToast("Please enter a prompt for the AI assistant.", "error"); return; }
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/ai-generate-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const draft = data.draft;
      setEditingRound((r) => ({ ...r, ...draft }));
      showToast("AI draft generated! Review and edit before saving.");
    } catch {
      showToast("AI generation failed. Try again.", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Save Round as Reusable Template ──────────────────────────────────
  const saveAsTemplate = async () => {
    if (!editingRound?.name) { showToast("Enter a round name before saving as template.", "error"); return; }
    setSavingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingRound),
      });
      if (!res.ok) throw new Error();
      showToast(`Template "${editingRound.name}" saved successfully.`);
    } catch {
      showToast("Failed to save template.", "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Round Type Templates (auto-fill) ─────────────────────────────────
  const ROUND_TYPE_TEMPLATES: Array<{
    type: DynamicRound["type"];
    name: string;
    icon: string;
    description: string;
    timeLimit: number;
    passingScore: number;
  }> = [
    { type: "mcq",              name: "Technical Quiz (MCQ)",         icon: "❓", description: "Multiple choice questions with 4 options and automatic scoring.",                             timeLimit: 30, passingScore: 50 },
    { type: "coding",           name: "Competitive Coding Challenge",  icon: "💻", description: "Algorithmic coding problems with multi-language compiler support and hidden test cases.",    timeLimit: 45, passingScore: 60 },
    { type: "bug_hunter",       name: "Bug Hunter & Code Fix",         icon: "🐛", description: "Identify syntax errors and logical flaws in broken code snippets.",                        timeLimit: 30, passingScore: 50 },
    { type: "rapid_fire",       name: "Rapid Fire Blitz",              icon: "🔥", description: "Fast-paced quiz with strict per-question timers and instant scoring.",                    timeLimit: 15, passingScore: 60 },
    { type: "aptitude",         name: "Aptitude & Logical Reasoning",  icon: "🧠", description: "Mathematical reasoning, series, puzzles, and data interpretation problems.",              timeLimit: 20, passingScore: 50 },
    { type: "sql",              name: "SQL Database Challenge",         icon: "🗄️", description: "Query databases using SQL — SELECT, JOIN, subqueries, and aggregate functions.",         timeLimit: 30, passingScore: 50 },
    { type: "output_prediction",name: "Output Prediction Round",       icon: "🎯", description: "Predict the exact output of given code snippets across multiple languages.",             timeLimit: 20, passingScore: 60 },
    { type: "fill_blanks",      name: "Fill in the Blanks",            icon: "✏️", description: "Complete partial code, statements, or concept definitions with correct terms.",           timeLimit: 25, passingScore: 50 },
    { type: "file_upload",      name: "File Upload Round",             icon: "📁", description: "Participants upload their solution file for manual evaluation by judges.",                timeLimit: 60, passingScore: 50 },
    { type: "manual",           name: "Manual Evaluation Round",       icon: "📝", description: "Open-ended questions evaluated manually by the competition organizer.",                  timeLimit: 45, passingScore: 50 },
    { type: "viva",             name: "Viva / Oral Presentation",      icon: "🎤", description: "Live Q&A or oral presentation round evaluated by panel judges.",                        timeLimit: 10, passingScore: 60 },
    { type: "ai_challenge",     name: "AI & Machine Learning Challenge",icon: "🤖", description: "Solve AI/ML problems — model training, predictions, and data science tasks.",          timeLimit: 60, passingScore: 60 },
    { type: "cyber_security",   name: "Cyber Security Challenge",      icon: "🛡️", description: "Vulnerability analysis, security concepts, and basic penetration testing tasks.",       timeLimit: 40, passingScore: 60 },
    { type: "web_dev",          name: "Web Development Challenge",     icon: "🌐", description: "Build or fix HTML/CSS/JS web components under a strict time limit.",                    timeLimit: 60, passingScore: 50 },
    { type: "mobile_dev",       name: "Mobile App Development",        icon: "📱", description: "Design or implement mobile application features and UI components.",                     timeLimit: 60, passingScore: 50 },
    { type: "ctf",              name: "Capture The Flag (CTF)",        icon: "🚩", description: "Security-focused flag hunting — cryptography, steganography, and web exploitation.",    timeLimit: 60, passingScore: 40 },
    { type: "custom",           name: "Custom Round",                  icon: "⚙️", description: "Fully custom round — configure every setting manually from scratch.",                  timeLimit: 30, passingScore: 50 },
  ];

  // ── Loading State ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 text-black">
      <AdminNav logout={logout} />

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-black tracking-tight">Portal Management</h1>
          <p className="text-neutral-500 mt-1 text-sm">Configure every aspect of Code Crackers without editing source code.</p>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-neutral-200 mb-8 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-black text-black"
                    : "border-transparent text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: General Info ── */}
        {activeTab === "general" && (
          <motion.div key="general" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🏛️" title="Event Information" subtitle="Displayed on certificates, PDFs, and participant dashboards." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Event Name" value={portalSettings.eventName} onChange={(v) => setPortalSettings((p) => ({ ...p, eventName: v }))} placeholder="Code Crackers" />
                <Field label="Event Subtitle" value={portalSettings.eventSubtitle} onChange={(v) => setPortalSettings((p) => ({ ...p, eventSubtitle: v }))} placeholder="Technical Quiz Competition" />
                <Field label="Symposium Name" value={portalSettings.symposiumName} onChange={(v) => setPortalSettings((p) => ({ ...p, symposiumName: v }))} placeholder="NEXUS'26" />
                <Field label="Event Date" value={portalSettings.eventDate} onChange={(v) => setPortalSettings((p) => ({ ...p, eventDate: v }))} type="date" />
                <Field label="Venue" value={portalSettings.venue} onChange={(v) => setPortalSettings((p) => ({ ...p, venue: v }))} placeholder="Main Seminar Hall" />
                <Field label="Browser Tab Title" value={portalSettings.browserTitle} onChange={(v) => setPortalSettings((p) => ({ ...p, browserTitle: v }))} placeholder="Code Crackers – NEXUS'26" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🏫" title="Institution Details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="College Name" value={portalSettings.collegeName} onChange={(v) => setPortalSettings((p) => ({ ...p, collegeName: v }))} />
                <Field label="Department Name" value={portalSettings.departmentName} onChange={(v) => setPortalSettings((p) => ({ ...p, departmentName: v }))} />
                <Field label="Event Coordinator Name" value={portalSettings.coordinatorName} onChange={(v) => setPortalSettings((p) => ({ ...p, coordinatorName: v }))} placeholder="Dr. / Prof. ..." />
                <Field label="HOD Name" value={portalSettings.hodName} onChange={(v) => setPortalSettings((p) => ({ ...p, hodName: v }))} placeholder="Dr. ..." />
                <div className="sm:col-span-2">
                  <Field label="Contact Details" value={portalSettings.contactDetails} onChange={(v) => setPortalSettings((p) => ({ ...p, contactDetails: v }))} placeholder="+91 9876543210 | email@college.edu" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={savePortalSettings}
                disabled={saving}
                className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Save General Settings
              </button>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Round Settings ── */}
        {activeTab === "rounds" && (
          <motion.div key="rounds" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Built-in Round Durations */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="⏱️" title="Built-in Round Durations" subtitle="Time limit (minutes) for the three core rounds." />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Round {r} Duration (min)</label>
                    <input
                      type="number"
                      value={roundDurations[r] || 30}
                      min={5}
                      max={180}
                      onChange={(e) => setRoundDurations((d) => ({ ...d, [r]: Number(e.target.value) }))}
                      className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none transition-all"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={saveRoundDurations}
                  disabled={saving}
                  className="bg-black text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  Save Durations
                </button>
              </div>
            </div>

            {/* Dynamic Rounds */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-6">
                <SectionHeader icon="🔄" title="Dynamic Rounds" subtitle="Create additional custom rounds beyond the 3 built-in rounds." />
                <button
                  onClick={openNewRound}
                  className="bg-black text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all flex items-center gap-2 shrink-0"
                >
                  + Add Round
                </button>
              </div>

              {dynamicRounds.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 text-sm">
                  <div className="text-3xl mb-3">🔄</div>
                  No dynamic rounds yet. Add one to extend beyond the 3 built-in rounds.
                </div>
              ) : (
                <div className="space-y-3">
                  {dynamicRounds.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl border-2 border-neutral-200 hover:border-black transition-all group">
                      <span className="text-2xl">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-black text-sm">{r.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.enabled ? "bg-black text-white" : "bg-zinc-100 text-neutral-500"}`}>
                            {r.enabled ? "Enabled" : "Disabled"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-black">{r.type}</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">{r.description || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-neutral-500">{r.timeLimit}m</span>
                        <button
                          onClick={() => openEditRound(r)}
                          className="px-3 py-1 rounded-lg border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRound(r.id)}
                          className="px-3 py-1 rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-bold transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── TAB: Security ── */}
        {activeTab === "security" && (
          <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🔒" title="Anti-Cheat & Security Controls" subtitle="Toggle security measures for the competition." />
              <div className="divide-y divide-neutral-100">
                <Toggle label="Require Fullscreen Mode" value={security.fullscreenModeEnabled} onChange={(v) => setSecurity((s) => ({ ...s, fullscreenModeEnabled: v }))} />
                <Toggle label="Block Right-Click" value={security.rightClickBlocked} onChange={(v) => setSecurity((s) => ({ ...s, rightClickBlocked: v }))} />
                <Toggle label="Restrict Copy & Paste" value={security.copyPasteRestricted} onChange={(v) => setSecurity((s) => ({ ...s, copyPasteRestricted: v }))} />
                <Toggle label="Block Keyboard Shortcuts (Ctrl+C, Ctrl+V, etc.)" value={security.keyboardShortcutsBlocked} onChange={(v) => setSecurity((s) => ({ ...s, keyboardShortcutsBlocked: v }))} />
                <Toggle label="Dev Tools Detection" value={security.devToolsDetectionEnabled} onChange={(v) => setSecurity((s) => ({ ...s, devToolsDetectionEnabled: v }))} />
                <Toggle label="Tab Switch Detection" value={security.tabSwitchDetectionEnabled} onChange={(v) => setSecurity((s) => ({ ...s, tabSwitchDetectionEnabled: v }))} />
                <Toggle label="Auto-Submit on Tab Switch Violation" value={security.autoSubmitOnTabSwitch} onChange={(v) => setSecurity((s) => ({ ...s, autoSubmitOnTabSwitch: v }))} />
                <Toggle label="Auto-Submit on Fullscreen Exit" value={security.autoSubmitOnFullscreenExit} onChange={(v) => setSecurity((s) => ({ ...s, autoSubmitOnFullscreenExit: v }))} />
                <Toggle label="Single Device Login (blocks multi-device access)" value={security.singleDeviceLoginEnabled} onChange={(v) => setSecurity((s) => ({ ...s, singleDeviceLoginEnabled: v }))} />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveSecurity}
                  disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Save Security Settings
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Messages ── */}
        {activeTab === "messages" && (
          <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="💬" title="Participant-Facing Messages" subtitle="Customize the text shown to participants at each stage of the competition." />
              <div className="space-y-4">
                <TextArea
                  label="Waiting for Evaluation Message"
                  value={portalSettings.messages.waitingForEvaluation}
                  onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, waitingForEvaluation: v } }))}
                  rows={3}
                />
                <TextArea
                  label="Countdown Message ('Get Ready' screen)"
                  value={portalSettings.messages.countdownMessage}
                  onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, countdownMessage: v } }))}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextArea
                    label="Round Started Message"
                    value={portalSettings.messages.roundStarted}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, roundStarted: v } }))}
                  />
                  <TextArea
                    label="Round Completed Message"
                    value={portalSettings.messages.roundCompleted}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, roundCompleted: v } }))}
                  />
                  <TextArea
                    label="Qualified Message"
                    value={portalSettings.messages.qualified}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, qualified: v } }))}
                  />
                  <TextArea
                    label="Eliminated Message"
                    value={portalSettings.messages.eliminated}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, eliminated: v } }))}
                  />
                  <TextArea
                    label="Submission Successful Message"
                    value={portalSettings.messages.submissionSuccessful}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, submissionSuccessful: v } }))}
                  />
                  <TextArea
                    label="Session Expired Message"
                    value={portalSettings.messages.sessionExpired}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, sessionExpired: v } }))}
                  />
                  <TextArea
                    label="Fullscreen Warning"
                    value={portalSettings.messages.fullscreenWarning}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, fullscreenWarning: v } }))}
                  />
                  <TextArea
                    label="Tab Switch Warning"
                    value={portalSettings.messages.tabSwitchWarning}
                    onChange={(v) => setPortalSettings((p) => ({ ...p, messages: { ...p.messages, tabSwitchWarning: v } }))}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={savePortalSettings}
                  disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Save Messages
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Leaderboard ── */}
        {activeTab === "leaderboard" && (
          <motion.div key="leaderboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Publish Controls */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="📢" title="Leaderboard Publish Controls" subtitle="Control which leaderboards are visible to participants." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["1", "2", "3", "overall"] as const).map((round) => {
                  const isPublished = publishedLeaderboards[round] ?? false;
                  return (
                    <div key={round} className={`flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${isPublished ? "border-black" : "border-neutral-200"}`}>
                      <div>
                        <p className="font-bold text-black text-sm">
                          {round === "overall" ? "Overall Leaderboard" : `Round ${round} Leaderboard`}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${isPublished ? "text-black" : "text-neutral-400"}`}>
                          {isPublished ? "✓ Visible to participants" : "Hidden from participants"}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleLeaderboard(round, !isPublished)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs border-2 transition-all ${
                          isPublished
                            ? "bg-black text-white border-black hover:bg-neutral-800"
                            : "bg-white text-neutral-500 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                      >
                        {isPublished ? "Hide" : "Publish"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard Display Settings */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🏆" title="Leaderboard Display Preferences" subtitle="Configure what is shown on leaderboards." />
              <div className="divide-y divide-neutral-100">
                <Toggle label="Show Score on Leaderboard" value={portalSettings.leaderboardShowScore} onChange={(v) => setPortalSettings((p) => ({ ...p, leaderboardShowScore: v }))} />
                <Toggle label="Show Time Taken" value={portalSettings.leaderboardShowTimeTaken} onChange={(v) => setPortalSettings((p) => ({ ...p, leaderboardShowTimeTaken: v }))} />
                <Toggle label="Show College" value={portalSettings.leaderboardShowCollege} onChange={(v) => setPortalSettings((p) => ({ ...p, leaderboardShowCollege: v }))} />
                <Toggle label="Show Department" value={portalSettings.leaderboardShowDepartment} onChange={(v) => setPortalSettings((p) => ({ ...p, leaderboardShowDepartment: v }))} />
              </div>
              <div className="mt-4">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500 block mb-2">Ranking Method</label>
                <div className="flex gap-3">
                  {[
                    { value: "score_then_time", label: "Score → Time (tiebreak by fastest)" },
                    { value: "score_only", label: "Score only" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPortalSettings((p) => ({ ...p, leaderboardRankingMethod: opt.value as "score_then_time" | "score_only" }))}
                      className={`px-4 py-2 rounded-xl border-2 font-bold text-xs transition-all ${
                        portalSettings.leaderboardRankingMethod === opt.value
                          ? "bg-black text-white border-black"
                          : "bg-white border-neutral-200 text-neutral-500 hover:border-black hover:text-black"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={savePortalSettings}
                  disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  Save Leaderboard Settings
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Backup & Restore ── */}
        {/* ── TAB: Appearance ── */}
        {activeTab === "appearance" && (
          <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🎨" title="Theme & Colours" subtitle="Customize the visual style of the Code Crackers portal." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Theme Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={appearance.themeColor}
                      onChange={(e) => setAppearance((a) => ({ ...a, themeColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-2 border-neutral-200 cursor-pointer" />
                    <span className="text-sm font-mono text-black">{appearance.themeColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Background Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={appearance.backgroundColor}
                      onChange={(e) => setAppearance((a) => ({ ...a, backgroundColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-2 border-neutral-200 cursor-pointer" />
                    <span className="text-sm font-mono text-black">{appearance.backgroundColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Button Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={appearance.buttonColor}
                      onChange={(e) => setAppearance((a) => ({ ...a, buttonColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-2 border-neutral-200 cursor-pointer" />
                    <span className="text-sm font-mono text-black">{appearance.buttonColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Font Style</label>
                  <select value={appearance.fontStyle}
                    onChange={(e) => setAppearance((a) => ({ ...a, fontStyle: e.target.value }))}
                    className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none">
                    {["Inter", "Roboto", "Outfit", "Poppins", "Montserrat", "DM Sans", "Space Grotesk"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🖥️" title="Portal Text & Display" subtitle="Customize the login banner, loading screen, and footer text." />
              <div className="space-y-4">
                <Field label="Login Page Banner Text" value={appearance.loginBannerText}
                  onChange={(v) => setAppearance((a) => ({ ...a, loginBannerText: v }))}
                  placeholder="Welcome to Code Crackers Technical Quiz" />
                <Field label="Loading Screen Message" value={appearance.loadingScreenMessage}
                  onChange={(v) => setAppearance((a) => ({ ...a, loadingScreenMessage: v }))}
                  placeholder="Loading Code Crackers..." />
                <Field label="Footer Text" value={appearance.footerText}
                  onChange={(v) => setAppearance((a) => ({ ...a, footerText: v }))}
                  placeholder="Code Crackers – NEXUS'26 | Department of CSBS" />
              </div>
              <div className="mt-4 divide-y divide-neutral-100">
                <Toggle label="Show Animations & Transitions" value={appearance.showAnimations}
                  onChange={(v) => setAppearance((a) => ({ ...a, showAnimations: v }))} />
                <Toggle label="Show College Logo in Header" value={appearance.showCollegeLogo}
                  onChange={(v) => setAppearance((a) => ({ ...a, showCollegeLogo: v }))} />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch(`${API_BASE}/api/portal/settings`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ appearance }),
                    });
                    if (!res.ok) throw new Error();
                    showToast("Appearance settings saved.");
                  } catch { showToast("Failed to save appearance.", "error"); }
                  finally { setSaving(false); }
                }}
                disabled={saving}
                className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Save Appearance Settings
              </button>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Participants ── */}
        {activeTab === "participants" && (
          <motion.div key="participants" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Generate Credentials */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🔑" title="Generate Participant Credentials" subtitle="Auto-generate usernames & passwords for batch participant creation." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Number of Participants</label>
                  <input type="number" value={participantOp.count} min={1} max={500}
                    onChange={(e) => setParticipantOp((p) => ({ ...p, count: Number(e.target.value) }))}
                    className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                </div>
                <Field label="Username Prefix" value={participantOp.prefix}
                  onChange={(v) => setParticipantOp((p) => ({ ...p, prefix: v }))}
                  placeholder="CC (generates CC001, CC002...)" />
                <Field label="Department" value={participantOp.department}
                  onChange={(v) => setParticipantOp((p) => ({ ...p, department: v }))}
                  placeholder="CSBS" />
                <Field label="College" value={participantOp.college}
                  onChange={(v) => setParticipantOp((p) => ({ ...p, college: v }))}
                  placeholder="Muthayammal Engineering College" />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  disabled={participantOp.generating}
                  onClick={async () => {
                    setParticipantOp((p) => ({ ...p, generating: true, generatedResult: null }));
                    try {
                      const res = await fetch(`${API_BASE}/api/participants/generate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          count: participantOp.count,
                          prefix: participantOp.prefix,
                          department: participantOp.department,
                          college: participantOp.college,
                        }),
                      });
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      setParticipantOp((p) => ({ ...p, generatedResult: data.participants || data }));
                      showToast(`Generated ${participantOp.count} participant accounts.`);
                    } catch { showToast("Failed to generate participants.", "error"); }
                    finally { setParticipantOp((p) => ({ ...p, generating: false })); }
                  }}
                  className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {participantOp.generating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Generate {participantOp.count} Accounts
                </button>
                {participantOp.generatedResult && (
                  <button
                    onClick={() => {
                      const rows = [["Username", "Password"], ...participantOp.generatedResult!.map((p) => [p.username, p.password])];
                      const csv = rows.map((r) => r.join(",")).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `credentials_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                    }}
                    className="border-2 border-neutral-200 hover:border-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                  >
                    📥 Download Credentials CSV
                  </button>
                )}
              </div>
              {participantOp.generatedResult && (
                <div className="mt-4 overflow-x-auto rounded-xl border-2 border-neutral-200 max-h-52">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-100 text-neutral-500 font-extrabold uppercase tracking-wider sticky top-0">
                      <tr><th className="px-4 py-2">Username</th><th className="px-4 py-2">Password</th></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {participantOp.generatedResult.slice(0, 20).map((p) => (
                        <tr key={p.username} className="hover:bg-stone-50">
                          <td className="px-4 py-2 font-bold text-black">{p.username}</td>
                          <td className="px-4 py-2 font-mono text-neutral-600">{p.password}</td>
                        </tr>
                      ))}
                      {participantOp.generatedResult.length > 20 && (
                        <tr><td colSpan={2} className="px-4 py-2 text-center text-neutral-400 text-xs">
                          + {participantOp.generatedResult.length - 20} more (download CSV to see all)
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bulk Operations */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="⚡" title="Bulk Operations" subtitle="Perform bulk actions across all participants at once." />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: "✅ Approve All", color: "border-neutral-200 hover:border-black", action: async () => {
                    if (!confirm("Approve ALL pending participants?")) return;
                    const res = await fetch(`${API_BASE}/api/participants/approve-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                    if (res.ok) showToast("All participants approved."); else showToast("Failed.", "error");
                  }},
                  { label: "📤 Export All (CSV)", color: "border-neutral-200 hover:border-black", action: () => {
                    window.open(`${API_BASE}/api/participants/credentials/export?token=${token}`, "_blank");
                  }},
                  { label: "🔄 Reset All Submissions", color: "border-red-200 text-red-600 hover:bg-red-50", action: async () => {
                    if (!confirm("⚠️ This will delete ALL participant submissions. Are you absolutely sure?")) return;
                    const res = await fetch(`${API_BASE}/api/participants/reset-submissions`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                    if (res.ok) showToast("All submissions reset."); else showToast("Failed.", "error");
                  }},
                ].map((op) => (
                  <button key={op.label} onClick={async () => { try { await op.action(); } catch { showToast("Operation failed.", "error"); } }}
                    className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all text-left ${op.color}`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Navigation */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🔗" title="Full Participant Management" subtitle="For individual participant operations, use the Participants admin page." />
              <button
                onClick={() => router.push("/admin/participants")}
                className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all"
              >
                Open Participants Dashboard →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Reports ── */}
        {activeTab === "reports" && (
          <motion.div key="reports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Report Header Customization */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="📄" title="Report Header & Branding" subtitle="Customize the header, footer, and branding on all generated reports." />
              <div className="space-y-4">
                <Field label="Report Title" value={reportSettings.reportTitle}
                  onChange={(v) => setReportSettings((r) => ({ ...r, reportTitle: v }))}
                  placeholder="Code Crackers Technical Quiz Report" />
                <Field label="Report Subtitle" value={reportSettings.reportSubtitle}
                  onChange={(v) => setReportSettings((r) => ({ ...r, reportSubtitle: v }))}
                  placeholder="NEXUS'26 | Department of CSBS" />
                <Field label="Footer Text" value={reportSettings.reportFooter}
                  onChange={(v) => setReportSettings((r) => ({ ...r, reportFooter: v }))}
                  placeholder="Muthayammal Engineering College (Autonomous) | NEXUS'26" />
              </div>
            </div>

            {/* Colors & Theme */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="🎨" title="Report Theme & Colours" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Text Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={reportSettings.reportTextColor}
                      onChange={(e) => setReportSettings((r) => ({ ...r, reportTextColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-2 border-neutral-200 cursor-pointer" />
                    <span className="text-sm font-mono">{reportSettings.reportTextColor}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Header Background Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={reportSettings.reportHeaderBgColor}
                      onChange={(e) => setReportSettings((r) => ({ ...r, reportHeaderBgColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-2 border-neutral-200 cursor-pointer" />
                    <span className="text-sm font-mono">{reportSettings.reportHeaderBgColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Report Theme</label>
                <div className="flex flex-wrap gap-3">
                  {(["default", "professional", "minimal", "colorful"] as const).map((t) => (
                    <button key={t} onClick={() => setReportSettings((r) => ({ ...r, reportTheme: t }))}
                      className={`px-4 py-2 rounded-xl border-2 font-bold text-xs capitalize transition-all ${
                        reportSettings.reportTheme === t ? "bg-black text-white border-black" : "border-neutral-200 text-neutral-500 hover:border-black"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-neutral-100">
                <Toggle label="Include College Logo in Reports" value={reportSettings.includeCollegeLogo}
                  onChange={(v) => setReportSettings((r) => ({ ...r, includeCollegeLogo: v }))} />
                <Toggle label="Include Coordinator Signature" value={reportSettings.includeCoordinatorSignature}
                  onChange={(v) => setReportSettings((r) => ({ ...r, includeCoordinatorSignature: v }))} />
                <Toggle label="Include HOD Signature" value={reportSettings.includeHodSignature}
                  onChange={(v) => setReportSettings((r) => ({ ...r, includeHodSignature: v }))} />
                <Toggle label="Show Rank in Reports" value={reportSettings.showRank}
                  onChange={(v) => setReportSettings((r) => ({ ...r, showRank: v }))} />
                <Toggle label="Show Score" value={reportSettings.showScore}
                  onChange={(v) => setReportSettings((r) => ({ ...r, showScore: v }))} />
                <Toggle label="Show Time Taken" value={reportSettings.showTimeTaken}
                  onChange={(v) => setReportSettings((r) => ({ ...r, showTimeTaken: v }))} />
                <Toggle label="Show Department" value={reportSettings.showDepartment}
                  onChange={(v) => setReportSettings((r) => ({ ...r, showDepartment: v }))} />
                <Toggle label="Show College" value={reportSettings.showCollege}
                  onChange={(v) => setReportSettings((r) => ({ ...r, showCollege: v }))} />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const res = await fetch(`${API_BASE}/api/portal/settings`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ reportSettings }),
                      });
                      if (!res.ok) throw new Error();
                      showToast("Report settings saved.");
                    } catch { showToast("Failed to save report settings.", "error"); }
                    finally { setSaving(false); }
                  }}
                  disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  Save Report Settings
                </button>
              </div>
            </div>

            {/* Quick Report Generation */}
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="⚡" title="Generate Reports" subtitle="Quickly navigate to the Reports page to generate and download reports." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "📊 Round Reports", href: "/admin/reports?tab=round" },
                  { label: "🏆 Overall Leaderboard Report", href: "/admin/reports?tab=overall" },
                  { label: "👥 Participant List Report", href: "/admin/reports?tab=participants" },
                  { label: "🔑 Username & Password Report", href: "/admin/reports?tab=credentials" },
                  { label: "🚨 Anti-Cheating Report", href: "/admin/reports?tab=violations" },
                  { label: "📋 Attendance Report", href: "/admin/reports?tab=attendance" },
                ].map((r) => (
                  <button key={r.label} onClick={() => router.push(r.href)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-neutral-200 hover:border-black font-bold text-sm text-left transition-all">
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Admin Users & Roles (Super Admin Authority) ── */}
        {activeTab === "admins" && (
          <motion.div key="admins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <SectionHeader icon="🛡️" title="Admin User Management & Permissions" subtitle="Manage Administrator accounts, roles, and granular permission access." />
                <button
                  onClick={() => {
                    setEditingAdmin({ username: "", password: "", fullName: "", email: "", department: "CSBS", role: "admin", permissions: ["view_participants"] });
                    setShowAdminModal(true);
                  }}
                  className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all flex items-center gap-2 shrink-0"
                >
                  + Add New Admin
                </button>
              </div>

              {admins.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 text-sm">
                  <div className="text-3xl mb-3">🛡️</div>
                  No admin users found. Click &quot;Add New Admin&quot; to create an account.
                </div>
              ) : (
                <div className="space-y-4">
                  {admins.map((adm) => (
                    <div key={adm.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-neutral-200 hover:border-black transition-all">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-extrabold text-black text-base">{adm.fullName || adm.username}</span>
                          <span className="text-neutral-400 text-xs">@{adm.username}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                            adm.role === "super_admin" ? "bg-black text-white" : "bg-zinc-100 text-black border border-neutral-200"
                          }`}>
                            {adm.role === "super_admin" ? "👑 SUPER ADMIN" : "ADMIN"}
                          </span>
                          {adm.isLocked && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-600">LOCKED</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">{adm.email || "No email"} • {adm.department || "CSBS"}</p>
                        
                        {/* Permissions Badges */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {adm.role === "super_admin" ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 text-black border border-neutral-200">
                              ⚡ Full System Authority (Implicit All)
                            </span>
                          ) : (adm.permissions || []).length === 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 text-neutral-400">No active permissions</span>
                          ) : (
                            adm.permissions.map((pKey: string) => (
                              <span key={pKey} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-black border border-neutral-200">
                                ✓ {pKey}
                              </span>
                            ))
                          )}
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
                          className="px-3.5 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                        >
                          Edit & Roles
                        </button>
                        {adm.role !== "super_admin" && (
                          <>
                            <button
                              onClick={async () => {
                                const res = await fetch(`${API_BASE}/api/admin/management/${adm.id}/toggle-lock`, {
                                  method: "POST",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) {
                                  showToast(`Admin ${adm.username} ${adm.isLocked ? "unlocked" : "locked"}.`);
                                  await fetchAdmins();
                                } else showToast("Failed to lock/unlock.", "error");
                              }}
                              className="px-3 py-1.5 rounded-xl border-2 border-neutral-200 hover:border-black text-xs font-bold transition-all"
                            >
                              {adm.isLocked ? "Unlock" : "Lock"}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete admin user ${adm.username}?`)) return;
                                const res = await fetch(`${API_BASE}/api/admin/management/${adm.id}`, {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) {
                                  showToast("Admin account deleted.");
                                  await fetchAdmins();
                                } else showToast("Failed to delete admin.", "error");
                              }}
                              className="px-3 py-1.5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "backup" && (
          <motion.div key="backup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="💾" title="Database Export & Backup" subtitle="Download a full JSON snapshot of all participants, submissions, questions, and settings." />
              <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                Backing up the database downloads the entire Code Crackers state file into a structured JSON format. You can store this backup safely or use it to clone settings for future events.
              </p>
              <button
                onClick={async () => {
                  if (!token) return;
                  try {
                    const res = await fetch(`${API_BASE}/api/portal/backup`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `code_crackers_backup_${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    showToast("Database backup downloaded successfully.");
                  } catch {
                    showToast("Failed to download database backup.", "error");
                  }
                }}
                className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all flex items-center gap-2"
              >
                <span>📥</span> Download Full JSON Backup
              </button>
            </div>

            <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <SectionHeader icon="📤" title="Restore Database Backup" subtitle="Upload a previously exported JSON backup to restore all portal data." />
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-4">
                ⚠️ Warning: Restoring a backup will overwrite all current users, submissions, and portal configurations with the data from the backup file.
              </div>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (evt) => {
                    try {
                      const json = JSON.parse(evt.target?.result as string);
                      if (!confirm("Are you sure you want to restore this database snapshot? All current data will be overwritten.")) return;
                      setSaving(true);
                      const res = await fetch(`${API_BASE}/api/portal/restore`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify(json),
                      });
                      if (!res.ok) throw new Error();
                      showToast("Portal database restored successfully!");
                      await fetchSettings();
                    } catch (err: any) {
                      showToast("Invalid JSON file or restore error.", "error");
                    } finally {
                      setSaving(false);
                    }
                  };
                  reader.readAsText(file);
                }}
                className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-2 file:border-black file:text-xs file:font-bold file:bg-white file:text-black hover:file:bg-neutral-100 transition-all cursor-pointer"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Dynamic Round Modal (with AI Builder & Template Wizard) ── */}
      <AnimatePresence>
        {showRoundModal && editingRound && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowRoundModal(false); setEditingRound(null); } }}
          >
            <motion.div
              className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-black">
                  {(editingRound as DynamicRound).id ? "Edit Round" : "Create New Round"}
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 bg-zinc-100 text-neutral-600 rounded-full border border-neutral-200 uppercase tracking-wider">
                  Dynamic Round Builder
                </span>
              </div>

              <div className="p-6 space-y-5">

                {/* ── AI Assistant Bar ── */}
                <div className="bg-stone-50 border-2 border-neutral-200 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                    <span>🤖</span> AI Round Generator
                    <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">DRAFT ONLY</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Describe the round you want. AI will generate a complete draft — review and edit everything before saving.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && generateAIDraft()}
                      placeholder='e.g. "Create a Java coding round with 5 easy questions" or "Aptitude test for first-year students"'
                      className="flex-1 bg-white border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none transition-all"
                    />
                    <button
                      onClick={generateAIDraft}
                      disabled={aiGenerating}
                      className="bg-black text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                      {aiGenerating
                        ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <span>⚡</span>}
                      {aiGenerating ? "Generating..." : "Generate Draft"}
                    </button>
                  </div>
                </div>

                {/* ── Template Type Grid ── */}
                <div className="space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
                    🏁 Select Round Type Template
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ROUND_TYPE_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.type}
                        onClick={() => setEditingRound((r) => r && ({
                          ...r,
                          type: tmpl.type,
                          name: r.name || tmpl.name,
                          icon: r.icon === "🏁" || !r.icon ? tmpl.icon : r.icon,
                          description: r.description || tmpl.description,
                          timeLimit: r.timeLimit || tmpl.timeLimit,
                          passingScore: r.passingScore || tmpl.passingScore,
                        }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          editingRound.type === tmpl.type
                            ? "bg-black text-white border-black"
                            : "bg-white border-neutral-200 hover:border-black text-black"
                        }`}
                      >
                        <div className="text-base mb-1">{tmpl.icon}</div>
                        <div className="text-[11px] font-extrabold leading-tight">{tmpl.name}</div>
                        <div className={`text-[10px] mt-0.5 font-medium leading-tight ${
                          editingRound.type === tmpl.type ? "text-white/70" : "text-neutral-500"
                        }`}>{tmpl.timeLimit} min · {tmpl.passingScore}% pass</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Basic Config ── */}
                <div className="space-y-4 border-t border-neutral-100 pt-4">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-400">Round Configuration</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Round Name" value={editingRound.name || ""} onChange={(v) => setEditingRound((r) => r && ({ ...r, name: v }))} placeholder="e.g. Rapid Fire" />
                    <Field label="Icon (Emoji)" value={editingRound.icon || "🏁"} onChange={(v) => setEditingRound((r) => r && ({ ...r, icon: v }))} placeholder="🏁" />
                  </div>
                  <TextArea label="Description" value={editingRound.description || ""} onChange={(v) => setEditingRound((r) => r && ({ ...r, description: v }))} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Duration (min)</label>
                      <input type="number" value={editingRound.timeLimit || 30} min={5} max={180} onChange={(e) => setEditingRound((r) => r && ({ ...r, timeLimit: Number(e.target.value) }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Countdown (sec)</label>
                      <input type="number" value={editingRound.countdownDuration || 10} min={0} max={60} onChange={(e) => setEditingRound((r) => r && ({ ...r, countdownDuration: Number(e.target.value) }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Max Score</label>
                      <input type="number" value={editingRound.maxScore || 100} min={0} onChange={(e) => setEditingRound((r) => r && ({ ...r, maxScore: Number(e.target.value) }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">Passing Score</label>
                      <input type="number" value={editingRound.passingScore || 50} min={0} onChange={(e) => setEditingRound((r) => r && ({ ...r, passingScore: Number(e.target.value) }))} className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none" />
                    </div>
                  </div>
                </div>

                {/* ── Round Options Toggles ── */}
                <div className="border-t border-neutral-100 pt-4 space-y-1">
                  <p className="text-xs font-bold tracking-widest uppercase text-neutral-400 mb-2">Round Options</p>
                  <Toggle label="Enabled" value={editingRound.enabled ?? true} onChange={(v) => setEditingRound((r) => r && ({ ...r, enabled: v }))} />
                  <Toggle label="Leaderboard Enabled" value={editingRound.leaderboardEnabled ?? true} onChange={(v) => setEditingRound((r) => r && ({ ...r, leaderboardEnabled: v }))} />
                  <Toggle label="Anti-Cheat Enabled" value={editingRound.antiCheatEnabled ?? true} onChange={(v) => setEditingRound((r) => r && ({ ...r, antiCheatEnabled: v }))} />
                  <Toggle label="Require Fullscreen" value={editingRound.fullscreenRequired ?? false} onChange={(v) => setEditingRound((r) => r && ({ ...r, fullscreenRequired: v }))} />
                  <Toggle label="Tab Detection" value={editingRound.tabDetectionEnabled ?? false} onChange={(v) => setEditingRound((r) => r && ({ ...r, tabDetectionEnabled: v }))} />
                  <Toggle label="Copy Protection" value={editingRound.copyProtectionEnabled ?? false} onChange={(v) => setEditingRound((r) => r && ({ ...r, copyProtectionEnabled: v }))} />
                  <Toggle label="Auto-Submit on Timeout" value={editingRound.autoSubmitOnTimeout ?? true} onChange={(v) => setEditingRound((r) => r && ({ ...r, autoSubmitOnTimeout: v }))} />
                  <Toggle label="Auto-Submit on Violation" value={editingRound.autoSubmitOnViolation ?? false} onChange={(v) => setEditingRound((r) => r && ({ ...r, autoSubmitOnViolation: v }))} />
                  <Toggle label="Allow Resubmission" value={editingRound.allowResubmission ?? false} onChange={(v) => setEditingRound((r) => r && ({ ...r, allowResubmission: v }))} />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-neutral-200 flex items-center justify-between flex-wrap gap-3">
                <button
                  onClick={saveAsTemplate}
                  disabled={savingTemplate}
                  className="px-4 py-2 rounded-xl border-2 border-neutral-200 hover:border-black font-bold text-xs transition-all flex items-center gap-2 text-neutral-600 hover:text-black"
                >
                  {savingTemplate
                    ? <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    : <span>💾</span>}
                  Save as Reusable Template
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowRoundModal(false); setEditingRound(null); }}
                    className="px-5 py-2 rounded-xl border-2 border-neutral-200 hover:border-black font-bold text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveRound}
                    disabled={saving}
                    className="bg-black text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                    {(editingRound as DynamicRound).id ? "Update Round" : "Create Round"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <Field label="Username" value={editingAdmin.username} onChange={(v) => setEditingAdmin((a) => ({ ...a, username: v }))} placeholder="johndoe" />
                  <Field label={editingAdmin.id ? "New Password (optional)" : "Password"} type="password" value={editingAdmin.password || ""} onChange={(v) => setEditingAdmin((a) => ({ ...a, password: v }))} placeholder="••••••••" />
                  <Field label="Full Name" value={editingAdmin.fullName} onChange={(v) => setEditingAdmin((a) => ({ ...a, fullName: v }))} placeholder="John Doe" />
                  <Field label="Email Address" type="email" value={editingAdmin.email} onChange={(v) => setEditingAdmin((a) => ({ ...a, email: v }))} placeholder="admin@college.edu" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Department" value={editingAdmin.department} onChange={(v) => setEditingAdmin((a) => ({ ...a, department: v }))} placeholder="CSBS" />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold tracking-widest uppercase text-neutral-500">System Role</label>
                    <select
                      value={editingAdmin.role}
                      onChange={(e) => setEditingAdmin((a) => ({ ...a, role: e.target.value as "super_admin" | "admin" }))}
                      className="bg-zinc-50 border-2 border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-sm text-black font-medium outline-none"
                    >
                      <option value="admin">Admin (Granular Permissions)</option>
                      <option value="super_admin">👑 Super Admin (Full System Authority)</option>
                    </select>
                  </div>
                </div>

                {editingAdmin.role === "admin" && (
                  <div className="border-t border-neutral-100 pt-4 space-y-2">
                    <p className="text-xs font-bold tracking-widest uppercase text-neutral-500 mb-2">Assigned Permissions Matrix</p>
                    {(availablePermissions.length > 0 ? availablePermissions : [
                      { key: "view_participants", label: "View Participants & Results" },
                      { key: "manage_participants", label: "Manage Participants (Create, Edit, Delete, Reset)" },
                      { key: "start_stop_rounds", label: "Start & Stop Competition Rounds" },
                      { key: "manage_questions", label: "Manage Questions (MCQ, Coding, Debug)" },
                      { key: "generate_reports", label: "Generate & Export Reports" },
                      { key: "publish_leaderboard", label: "Publish & Hide Leaderboards" },
                      { key: "manage_security", label: "Manage Anti-Cheat & Security Settings" },
                      { key: "portal_settings", label: "Manage Portal Branding & Configuration" },
                    ]).map((perm: { key: string; label: string }) => {
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
                    setSaving(true);
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
                      await fetchAdmins();
                    } catch (err: any) {
                      showToast(err.message || "Failed to save admin.", "error");
                    } finally { setSaving(false); }
                  }}
                  disabled={saving}
                  className="bg-black text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
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
