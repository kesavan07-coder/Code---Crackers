"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownOverlayProps {
  countdownStartedAt: string | null; // ISO string from server
  roundStartedAt: string | null;     // ISO string (countdownStartedAt + 10s)
  roundName?: string;
  message?: string;
  onComplete: () => void;            // Called when countdown expires on client
}

/**
 * Server-synced 10-second countdown overlay.
 * Uses countdownStartedAt (server time when admin pressed Start Round) to
 * calculate remaining seconds on any participant's device regardless of local clock.
 */
export default function CountdownOverlay({
  countdownStartedAt,
  roundStartedAt,
  roundName = "Round",
  message = "Get Ready! The round is about to begin.",
  onComplete,
}: CountdownOverlayProps) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!countdownStartedAt || !roundStartedAt) return;

    const roundStart = new Date(roundStartedAt).getTime();
    const now = Date.now();

    // If round already started on the server, skip countdown
    if (now >= roundStart) {
      setVisible(false);
      onComplete();
      return;
    }

    const remaining = Math.ceil((roundStart - now) / 1000);
    setSecsLeft(remaining);
    setVisible(true);

    const interval = setInterval(() => {
      const newRemaining = Math.ceil((roundStart - Date.now()) / 1000);
      if (newRemaining <= 0) {
        clearInterval(interval);
        setSecsLeft(0);
        setVisible(false);
        onComplete();
      } else {
        setSecsLeft(newRemaining);
      }
    }, 200); // Poll at 200ms for smooth updates

    return () => clearInterval(interval);
  }, [countdownStartedAt, roundStartedAt, onComplete]);

  if (!visible || secsLeft === null) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="countdown-overlay"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Round name pill */}
        <motion.div
          className="mb-8 px-6 py-2 rounded-full border border-white/20 text-white/70 text-sm font-medium tracking-widest uppercase"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {roundName}
        </motion.div>

        {/* Countdown number */}
        <AnimatePresence mode="wait">
          <motion.div
            key={secsLeft}
            className="text-white font-extrabold"
            style={{ fontSize: "clamp(8rem, 20vw, 16rem)", lineHeight: 1 }}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {secsLeft}
          </motion.div>
        </AnimatePresence>

        {/* Message */}
        <motion.p
          className="mt-8 text-white/60 text-center text-lg max-w-md px-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>

        {/* Progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-white"
          initial={{ width: "100%" }}
          animate={{ width: `${(secsLeft / 10) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
