"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface PortalSettings {
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

export interface DynamicRound {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
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

interface PortalContextValue {
  portalSettings: PortalSettings;
  dynamicRounds: DynamicRound[];
  competitionState: string;
  currentRound: number;
  announcement: string | null;
  broadcastMessage: string | null;
  refreshPortalInfo: () => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_SETTINGS: PortalSettings = {
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
};

const PortalContext = createContext<PortalContextValue>({
  portalSettings: DEFAULT_SETTINGS,
  dynamicRounds: [],
  competitionState: "idle",
  currentRound: 0,
  announcement: null,
  broadcastMessage: null,
  refreshPortalInfo: async () => {},
  isLoading: true,
});

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [dynamicRounds, setDynamicRounds] = useState<DynamicRound[]>([]);
  const [competitionState, setCompetitionState] = useState("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPublicInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/portal/public-info`);
      if (res.ok) {
        const data = await res.json();
        if (data.portalSettings && Object.keys(data.portalSettings).length > 0) {
          setPortalSettings((prev) => ({
            ...prev,
            ...data.portalSettings,
            messages: { ...prev.messages, ...(data.portalSettings.messages || {}) },
          }));
        }
        if (data.dynamicRounds) {
          setDynamicRounds(data.dynamicRounds);
        }
        if (data.competitionState) setCompetitionState(data.competitionState);
        if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
        setAnnouncement(data.announcement || null);
        setBroadcastMessage(data.broadcastMessage || null);
      }
    } catch {
      // Keep default settings on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicInfo();
    const interval = setInterval(fetchPublicInfo, 10000);
    return () => clearInterval(interval);
  }, [fetchPublicInfo]);

  // Update browser title dynamically
  useEffect(() => {
    if (portalSettings.browserTitle && typeof document !== "undefined") {
      document.title = portalSettings.browserTitle;
    }
  }, [portalSettings.browserTitle]);

  return (
    <PortalContext.Provider
      value={{
        portalSettings,
        dynamicRounds,
        competitionState,
        currentRound,
        announcement,
        broadcastMessage,
        refreshPortalInfo: fetchPublicInfo,
        isLoading,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
