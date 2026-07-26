"use client";

import { useEffect, useState, useRef } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"enter" | "loading" | "exit">("enter");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setPhase("loading");

      const DURATION = 2200;
      const easeInOut = (t: number) =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const tick = (ts: number) => {
        if (!startRef.current) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const raw = Math.min(elapsed / DURATION, 1);
        const eased = easeInOut(raw);
        setProgress(Math.round(eased * 100));

        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setTimeout(() => {
            setPhase("exit");
            setTimeout(() => onComplete(), 800);
          }, 350);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }, 400);

    return () => {
      clearTimeout(enterTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  const isExiting = phase === "exit";

  return (
    <>
      <style>{`
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes barIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transform: isExiting ? "translateY(-100vh)" : "translateY(0)",
          transition: isExiting
            ? "transform 0.75s cubic-bezier(0.76,0,0.24,1)"
            : "none",
          willChange: "transform",
        }}
      >
        {/* ── MUTHAYAMMAL ENGINEERING COLLEGE BANNER ── */}
        <div
          style={{
            animation: "logoIn 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both",
            opacity: isExiting ? 0 : undefined,
            transition: isExiting ? "opacity 0.35s ease" : undefined,
            marginBottom: 48,
            padding: "0 24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/mec-banner.png"
            alt="Muthayammal Engineering College"
            style={{
              width: "min(850px, 88vw)",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* ── Progress bar section ── */}
        <div
          style={{
            width: "min(420px, 60vw)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            animation: "barIn 0.6s cubic-bezier(0.22,1,0.36,1) 0.45s both",
            opacity: isExiting ? 0 : undefined,
            transition: isExiting ? "opacity 0.25s ease" : undefined,
          }}
        >
          {/* Spinner + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              style={{ animation: "spin 0.85s linear infinite", flexShrink: 0 }}
            >
              <circle
                cx="9" cy="9" r="7"
                fill="none"
                stroke="rgba(20,46,166,0.12)"
                strokeWidth="2.5"
              />
              <circle
                cx="9" cy="9" r="7"
                fill="none"
                stroke="#142ea6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="34"
                strokeDashoffset="9"
              />
            </svg>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#142ea6",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Loading...
            </span>
          </div>

          {/* Bar track */}
          <div
            style={{
              width: "100%",
              height: 5,
              borderRadius: 99,
              background: "rgba(20,46,166,0.08)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Fill */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, bottom: 0,
                width: `${progress}%`,
                background: "linear-gradient(90deg, #142ea6 0%, #3d5fe0 100%)",
                borderRadius: 99,
                transition: "width 0.04s linear",
                boxShadow: "0 0 12px rgba(20,46,166,0.3)",
              }}
            />
            {/* Shimmer sweep */}
            {progress > 2 && progress < 99 && (
              <div
                style={{
                  position: "absolute",
                  top: 0, bottom: 0,
                  width: "35%",
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                  animation: "shimmer 1.3s ease-in-out infinite",
                }}
              />
            )}
          </div>

          {/* Percentage counter */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#142ea6",
              letterSpacing: "0.04em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {progress}%
          </span>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            height: 3,
            background:
              "linear-gradient(90deg, transparent 0%, #142ea6 50%, transparent 100%)",
            opacity: 0.15,
          }}
        />
      </div>
    </>
  );
}
