"use client";

import { useEffect, useRef } from "react";

interface AntiCheatOptions {
  disablePaste?: boolean;
  disableRightClick?: boolean;
  onTabSwitch?: () => void;
  onFullscreenExit?: () => void;
  onViolation?: (type: string, details?: string) => void;
}

export function useAntiCheat({
  disablePaste = true,
  disableRightClick = true,
  onTabSwitch,
  onFullscreenExit,
  onViolation,
}: AntiCheatOptions) {
  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || listenersAttachedRef.current) return;
    listenersAttachedRef.current = true;

    // ── Prevent Right Click ──
    const handleContextMenu = (e: MouseEvent) => {
      if (disableRightClick) {
        e.preventDefault();
        onViolation?.("RIGHT_CLICK", "User right-clicked on page");
      }
    };

    // ── Keyboard Shortcut Restrictions & DevTools Detection ──
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K)
      if (
        e.key === "F12" ||
        (ctrlOrCmd && e.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
        (ctrlOrCmd && key === "u") // View source
      ) {
        e.preventDefault();
        onViolation?.("DEVTOOLS_ATTEMPT", `Pressed shortcut: ${e.key}`);
        return;
      }

      // Print (Ctrl+P)
      if (ctrlOrCmd && key === "p") {
        e.preventDefault();
        onViolation?.("PRINT_ATTEMPT", "Attempted to print page (Ctrl+P)");
        return;
      }

      // Save (Ctrl+S)
      if (ctrlOrCmd && key === "s") {
        e.preventDefault();
        onViolation?.("SAVE_PAGE_ATTEMPT", "Attempted to save page (Ctrl+S)");
        return;
      }

      // Copy / Paste / Cut
      if (disablePaste && ctrlOrCmd && ["c", "v", "x"].includes(key)) {
        e.preventDefault();
        const vType = key === "c" ? "COPY_ATTEMPT" : key === "v" ? "PASTE_ATTEMPT" : "CUT_ATTEMPT";
        onViolation?.(vType, `Keyboard shortcut Ctrl+${key.toUpperCase()}`);
      }
    };

    // ── Clipboard DOM Events ──
    const handleCopy = (e: ClipboardEvent) => {
      if (disablePaste) {
        e.preventDefault();
        onViolation?.("COPY_ATTEMPT", "DOM copy event");
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (disablePaste) {
        e.preventDefault();
        onViolation?.("PASTE_ATTEMPT", "DOM paste event");
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (disablePaste) {
        e.preventDefault();
        onViolation?.("CUT_ATTEMPT", "DOM cut event");
      }
    };

    // ── Window Focus Loss (Blur) ──
    const handleWindowBlur = () => {
      onViolation?.("WINDOW_BLUR", "Browser window lost focus");
    };

    // ── Tab Switch / Visibility Change ──
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onViolation?.("TAB_SWITCH", "User switched tab or minimized browser");
        onTabSwitch?.();
      }
    };

    // ── Fullscreen Exit ──
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onViolation?.("FULLSCREEN_EXIT", "Exited full screen mode");
        onFullscreenExit?.();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("cut", handleCut);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("cut", handleCut);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      listenersAttachedRef.current = false;
    };
  }, [disablePaste, disableRightClick, onTabSwitch, onFullscreenExit, onViolation]);

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
