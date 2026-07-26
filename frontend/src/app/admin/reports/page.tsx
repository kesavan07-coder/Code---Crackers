"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ParticipantReportData {
  rank: number;
  username: string;
  fullName: string;
  department: string;
  college: string;
  qualificationStatus: string;
  round1: { score: number; submissionTime: string; status: string; timeTaken: string };
  round2: { score: number; submissionTime: string; status: string; timeTaken: string };
  round3: { score: number; submissionTime: string; status: string; timeTaken: string };
  totalScore: number;
}

interface SavedReport {
  id: string;
  name: string;
  type: "Round 1" | "Round 2" | "Round 3" | "Overall";
  generatedAt: string;
  size: string;
  url: string;
}

const REPORTS_KEY = "cc_admin_reports";

function loadReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReports(reports: SavedReport[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "submitted": return "Submitted";
    case "in_progress": return "In Progress";
    case "not_started": return "Not Started";
    default: return status;
  }
}

type NavItem = { label: string; href: string };
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Participants", href: "/admin/participants" },
  { label: "Questions", href: "/admin/questions" },
  { label: "Security", href: "/admin/security" },
  { label: "Reports", href: "/admin/reports" },
];

function AdminNav({ active }: { active: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <header className="w-full h-16 bg-white px-6 md:px-12 flex items-center gap-6 sticky top-0 z-50 border-b border-neutral-200 shadow-sm">
      <img
        src="/college_logo.png"
        alt="Muthayammal Engineering College Logo"
        className="w-9 h-9 object-contain rounded-xl border border-neutral-200 p-0.5 bg-white flex-shrink-0"
      />
      <nav className="flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer border-2 transition-colors whitespace-nowrap ${
              active === item.href
                ? "bg-black text-white border-black"
                : "text-neutral-500 border-transparent hover:border-neutral-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button
        onClick={logout}
        className="ml-auto text-xs font-bold text-neutral-400 hover:text-red-500 transition-colors uppercase tracking-widest"
      >
        Logout
      </button>
    </header>
  );
}

export default function ReportsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [reportData, setReportData] = useState<ParticipantReportData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (user && user.role !== "admin") { router.replace("/dashboard"); return; }
    setSavedReports(loadReports());
  }, [token, user, router]);

  const fetchReportData = useCallback(async () => {
    if (!token) return null;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/participants/reports/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ParticipantReportData[] = await res.json();
        setReportData(data);
        return data;
      } else {
        showToast("Failed to fetch report data.", "error");
        return null;
      }
    } catch {
      showToast("Server error fetching data.", "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const generatePDF = async (type: "Round 1" | "Round 2" | "Round 3" | "Overall") => {
    setGenerating(type);
    let data = reportData;
    if (!data) {
      data = await fetchReportData();
    }
    if (!data) { setGenerating(null); return; }

    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Code Crackers Symposium", 14, 16);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${type} Report`, 14, 23);
      doc.setFontSize(9);
      doc.text(`Generated: ${dateStr} at ${timeStr}`, 14, 29);

      // Stats summary
      const submitted = data.filter(p => {
        if (type === "Round 1") return p.round1.status === "submitted";
        if (type === "Round 2") return p.round2.status === "submitted";
        if (type === "Round 3") return p.round3.status === "submitted";
        return p.totalScore > 0;
      }).length;

      doc.setFont("helvetica", "bold");
      doc.text(`Total Participants: ${data.length}  |  Submitted: ${submitted}`, 14, 35);

      let tableHead: string[][];
      let tableBody: (string | number)[][];

      if (type === "Round 1") {
        tableHead = [["Rank", "Username", "Full Name", "Dept", "R1 Score", "Submission Time", "Time Taken", "Status"]];
        tableBody = data.map(p => [
          p.rank,
          p.username,
          p.fullName,
          p.department,
          `${p.round1.score} pts`,
          p.round1.submissionTime,
          p.round1.timeTaken,
          getStatusLabel(p.round1.status),
        ]);
      } else if (type === "Round 2") {
        tableHead = [["Rank", "Username", "Full Name", "Dept", "R2 Score", "Submission Time", "Time Taken", "Status"]];
        tableBody = data.map(p => [
          p.rank,
          p.username,
          p.fullName,
          p.department,
          `${p.round2.score} pts`,
          p.round2.submissionTime,
          p.round2.timeTaken,
          getStatusLabel(p.round2.status),
        ]);
      } else if (type === "Round 3") {
        tableHead = [["Rank", "Username", "Full Name", "Dept", "R3 Score", "Submission Time", "Time Taken", "Status"]];
        tableBody = data.map(p => [
          p.rank,
          p.username,
          p.fullName,
          p.department,
          `${p.round3.score} pts`,
          p.round3.submissionTime,
          p.round3.timeTaken,
          getStatusLabel(p.round3.status),
        ]);
      } else {
        // Overall
        tableHead = [["Rank", "Username", "Full Name", "Dept", "College", "R1", "R2", "R3", "Total", "Status"]];
        tableBody = data.map(p => [
          p.rank,
          p.username,
          p.fullName,
          p.department,
          p.college,
          `${p.round1.score}`,
          `${p.round2.score}`,
          `${p.round3.score}`,
          `${p.totalScore} pts`,
          p.qualificationStatus.toUpperCase(),
        ]);
      }

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 40,
        styles: {
          fontSize: 9,
          cellPadding: 3,
          textColor: [20, 20, 20],
          lineColor: [220, 220, 220],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        tableWidth: "auto",
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Code Crackers — Confidential  |  Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 8,
          { align: "center" }
        );
      }

      const fileName = `${type.replace(" ", "_")}_Report_${now.toISOString().slice(0, 10)}.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      // Auto-download
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Save to repository
      const size = `${(blob.size / 1024).toFixed(1)} KB`;
      const newReport: SavedReport = {
        id: `${Date.now()}`,
        name: fileName,
        type,
        generatedAt: now.toISOString(),
        size,
        url,
      };
      const updatedReports = [newReport, ...savedReports].slice(0, 20);
      setSavedReports(updatedReports);
      saveReports(updatedReports);
      showToast(`${type} report generated and downloaded.`);
    } catch (err) {
      console.error(err);
      showToast("Failed to generate PDF.", "error");
    } finally {
      setGenerating(null);
    }
  };

  const deleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    saveReports(updated);
    showToast("Report removed.");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  const reportTypes: Array<{ type: "Round 1" | "Round 2" | "Round 3" | "Overall"; description: string; icon: string }> = [
    { type: "Round 1", description: "MCQ scores, submission time, time taken per participant", icon: "①" },
    { type: "Round 2", description: "Coding round scores, submission times, status", icon: "②" },
    { type: "Round 3", description: "Bug Hunter scores, submission times, status", icon: "③" },
    { type: "Overall", description: "Combined leaderboard across all three rounds", icon: "★" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-black flex flex-col">
      <AdminNav active="/admin/reports" />

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

      <main className="max-w-5xl mx-auto w-full px-6 md:px-12 py-10 flex flex-col gap-10 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-black tracking-tight">Reports</h1>
            <p className="text-xs font-semibold text-neutral-400 mt-1 uppercase tracking-widest">Generate & Download Competition PDFs</p>
          </div>
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border-2 border-neutral-200 bg-white hover:border-black transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Fetching…" : "Refresh Data"}
          </button>
        </div>

        {/* Report Generation Cards */}
        <div>
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Generate Report</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map(({ type, description, icon }) => (
              <div
                key={type}
                className="bg-white border-2 border-neutral-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:border-neutral-400 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-black border border-neutral-200">
                    {icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-black">{type} Report</h3>
                    <p className="text-xs text-neutral-400 font-semibold mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  onClick={() => generatePDF(type)}
                  disabled={generating !== null}
                  className="w-full py-3 bg-black text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {generating === type ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Report Repository */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Report Repository</h2>
            {savedReports.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all saved report history? (The downloaded files are NOT deleted.)")) {
                    setSavedReports([]);
                    saveReports([]);
                  }
                }}
                className="text-xs font-bold text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {savedReports.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-neutral-200 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
              <FileText className="text-neutral-300" size={40} />
              <p className="text-sm font-bold text-neutral-400">No reports generated yet.</p>
              <p className="text-xs text-neutral-300 font-semibold">Generated reports will appear here.</p>
            </div>
          ) : (
            <div className="bg-white border-2 border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-5 py-3.5">Report Name</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-5 py-3.5 hidden md:table-cell">Type</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-5 py-3.5 hidden md:table-cell">Generated At</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-5 py-3.5 hidden md:table-cell">Size</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {savedReports.map((report, idx) => (
                    <tr key={report.id} className={`border-b border-neutral-50 hover:bg-stone-50 transition-colors ${idx === savedReports.length - 1 ? "border-none" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-neutral-400 flex-shrink-0" />
                          <span className="text-xs font-bold text-black truncate max-w-[200px]">{report.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-zinc-100 text-black uppercase tracking-wider">{report.type}</span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-xs font-semibold text-neutral-500">
                          {new Date(report.generatedAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-xs font-semibold text-neutral-400">{report.size}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={report.url}
                            download={report.name}
                            className="p-2 rounded-lg border-2 border-neutral-200 hover:border-black transition-colors text-neutral-600 hover:text-black"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => deleteReport(report.id)}
                            className="p-2 rounded-lg border-2 border-red-100 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
