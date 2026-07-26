"use client";

import { useEffect, useRef } from "react";

interface AntiCheatOptions {
  disablePaste?: boolean;
  disableRightClick?: boolean;
  onTabSwitch?: () => void;
  onFullscreenExit?: () => void;
}

export function useAntiCheat({
  disablePaste = true,
  disableRightClick = true,
  onTabSwitch,
  onFullscreenExit,
}: AntiCheatOptions) {
  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || listenersAttachedRef.current) return;
    listenersAttachedRef.current = true;

    // ── Prevent Right Click ──
    const handleContextMenu = (e: MouseEvent) => {
      if (disableRightClick) {
        e.preventDefault();
      }
    };

    // ── Prevent Copy/Paste/Cut ──
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disablePaste) {
        // Ctrl+C, Ctrl+V, Ctrl+X, Cmd+C, Cmd+V, Cmd+X
        const isClipboardKey = (e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(e.key.toLowerCase());
        if (isClipboardKey) {
          e.preventDefault();
        }
      }
    };

    // ── Tab Switch / Visibility Change ──
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onTabSwitch?.();
      }
    };

    // ── Fullscreen Exit ──
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onFullscreenExit?.();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      listenersAttachedRef.current = false;
    };
  }, [disablePaste, disableRightClick, onTabSwitch, onFullscreenExit]);

  // Request entering fullscreen
  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request rejected or blocked by user gesture:", err);
    }
  };

  return { enterFullscreen };
}
