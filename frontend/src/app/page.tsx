"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const hasRedirected = useRef(false);

  // Animate progress counter over ~2 seconds
  useEffect(() => {
    let startTime: number | null = null;
    const duration = 2000;
    let raf: number;

    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const pct = Math.min(1, elapsed / duration);
      setProgress(Math.floor(pct * 100));
      if (pct < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        // Hold at 100% briefly then start exit
        setTimeout(() => {
          setExiting(true);
          setTimeout(() => setSplashDone(true), 600);
        }, 300);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // After splash completes + auth resolved → redirect
  useEffect(() => {
    if (!splashDone || authLoading || hasRedirected.current) return;
    hasRedirected.current = true;

    if (token && user) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } else {
      router.replace("/login");
    }
  }, [splashDone, authLoading, token, user, router]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Subtle animated background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center gap-10 transition-all duration-700"
        style={{
          opacity: exiting ? 0 : 1,
          transform: exiting ? "scale(0.97)" : "scale(1)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 select-none">
          <img
            src="/college_logo.png"
            alt="Muthayammal Engineering College Logo"
            className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-2xl bg-white p-2 rounded-2xl"
            style={{ filter: "drop-shadow(0 0 40px rgba(255,255,255,0.25))" }}
          />
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-baseline gap-0">
            <span className="text-5xl md:text-7xl font-extrabold uppercase tracking-tighter text-white leading-none">
              Code
            </span>
            <span className="text-5xl md:text-7xl font-extrabold uppercase tracking-tighter text-white leading-none">
              &#8203;
            </span>
            <span className="text-5xl md:text-7xl font-extrabold uppercase tracking-tighter text-white leading-none">
              Crackers
            </span>
          </div>
          <span className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.4em] text-white/40 mt-1">
            Technical Competition
          </span>
        </div>

        {/* Progress indicator */}
        <div className="flex flex-col items-center gap-4 w-72 md:w-96">
          {/* Bar */}
          <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: `${progress}%`,
                transition: "width 50ms linear",
              }}
            />
          </div>
          {/* Counter */}
          <span className="text-3xl md:text-4xl font-bold tabular-nums tracking-tighter text-white/70">
            {String(progress).padStart(2, "0")}%
          </span>
        </div>
      </div>
    </div>
  );
}
