"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { usePortal } from "@/lib/portalContext";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function WaitingRoomPage() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const { portalSettings } = usePortal();
  const router = useRouter();
  const [timeLeftStr, setTimeLeftStr] = useState("Initializing...");
  const [adminMessage, setAdminMessage] = useState("Waiting for the host to start the competition");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth hydration before redirecting
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user && (user.role === "admin" || user.role === "super_admin")) {
      router.replace("/admin");
      return;
    }

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/competition/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401 || res.status === 403) {
          // Locked, disabled, or session expired
          logout();
          return;
        }

        if (!res.ok) throw new Error();
        const status = await res.json();

        // 1. Check approval status
        const userApproved = status.user ? status.user.isApproved : true;
        setIsApproved(userApproved);

        // 2. Fetch announcements & broadcasts
        setAnnouncement(status.announcement || null);
        setBroadcastMessage(status.broadcastMessage || null);

        if (!userApproved) {
          setTimeLeftStr("Hold");
          setAdminMessage("Your registration is pending approval by the administrator.");
          return;
        }

        // If approved and the admin has explicitly started the round, redirect to dashboard
        const currentRound = status.currentRound || 1;
        const isRoundExplicitlyStarted = !!(status.roundStartedAt && status.roundStartedAt[currentRound]);

        if ((status.competitionState === "running" || status.competitionState === "paused") && isRoundExplicitlyStarted) {
          router.replace("/dashboard");
          return;
        }

        if (status.competitionState === "ended") {
          setAdminMessage("The competition has ended. Thank you for participating.");
          setTimeLeftStr("Finished");
          return;
        }

        if (status.roundStatus === "open" && !isRoundExplicitlyStarted) {
          setTimeLeftStr("Ready");
          setAdminMessage(`Round ${currentRound} is open. Waiting for the admin to click "Start Round"...`);
          return;
        }

        if (status.startedAt) {
          const serverNow = status.serverTime ? new Date(status.serverTime).getTime() : Date.now();
          const startTime = new Date(status.startedAt).getTime();
          const diff = startTime - serverNow;

          if (diff > 0) {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeftStr(
              `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            );
            setAdminMessage("Competition starts soon...");
          } else {
            setTimeLeftStr("Starting...");
          }
        } else {
          setTimeLeftStr("00:00");
          setAdminMessage("Waiting for the host to start the competition");
        }
      } catch {
        // network silent
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 4000);

    return () => clearInterval(intervalId);
  }, [authLoading, token, user, router, logout]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        {/* Broadcast Message Banner */}
        {broadcastMessage && (
          <div className="bg-black text-white px-6 py-4 rounded-2xl border-2 border-black text-center shadow-[0_8px_30px_rgb(0,0,0,0.05)] animate-pulse">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 block mb-1">
              Broadcast from Admin
            </span>
            <p className="text-sm font-extrabold tracking-tight">
              {broadcastMessage}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-14 text-center flex flex-col items-center border-2 border-neutral-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <img
            src={portalSettings.collegeLogo || "/college_logo.png"}
            alt={portalSettings.collegeName || "College Logo"}
            className="w-16 h-16 object-contain mb-4 rounded-xl border border-neutral-200 p-1 bg-white"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-8">
            {isApproved ? "Lounge" : "Authorization Lounge"}
          </span>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-black leading-tight mb-6 sm:mb-8">
            {isApproved ? "Waiting for the competition to begin..." : "Approval Required"}
          </h1>

          <div className="flex flex-col items-center gap-2 mb-8">
            <span className="text-5xl sm:text-6xl md:text-8xl font-extrabold tabular-nums tracking-tighter text-black">
              {timeLeftStr}
            </span>
            <p className="text-sm font-bold text-neutral-500 max-w-md">
              {adminMessage}
            </p>
          </div>

          {/* Announcement Block */}
          {announcement && (
            <div className="w-full bg-zinc-50 border-2 border-neutral-200 rounded-xl p-5 mb-8 text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-2">
                Announcement
              </span>
              <p className="text-sm font-semibold text-black leading-relaxed">
                {announcement}
              </p>
            </div>
          )}

          <div className="w-full border-t border-neutral-200 pt-6 sm:pt-8 mt-2 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              Participant <span className="text-black font-extrabold">{user?.username}</span> <span className="text-neutral-400">({user?.department || portalSettings.departmentName || "CSBS"})</span>
            </p>
            <button
              onClick={logout}
              className="text-xs font-bold tracking-widest uppercase cursor-pointer hover:text-black transition-colors duration-200 text-neutral-400"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
