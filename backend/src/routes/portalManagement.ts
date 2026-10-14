import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Competition, ActivityLog, DynamicRound, PortalSettings, RoundTemplate, db } from "../config/database";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

function getOrSeedDynamicRounds(comp: any): DynamicRound[] {
  let rounds: DynamicRound[] = comp.dynamicRounds || [];
  if (rounds.length === 0) {
    rounds = [
      {
        id: "built_in_1",
        name: "Round 1 – MCQ Quiz",
        description: "Solve multiple-choice questions focused on data structures, algorithms, and core programming paradigms.",
        icon: "❓",
        type: "mcq",
        order: 1,
        timeLimit: comp.roundDurations?.[1] || 30,
        countdownDuration: 10,
        maxScore: 100,
        passingScore: 50,
        enabled: true,
        leaderboardEnabled: true,
        antiCheatEnabled: true,
        fullscreenRequired: false,
        tabDetectionEnabled: false,
        copyProtectionEnabled: false,
        autoSubmitOnTimeout: true,
        autoSubmitOnViolation: false,
        allowResubmission: false,
      },
      {
        id: "built_in_2",
        name: "Round 2 – Coding Challenge",
        description: "Tackle narrative coding challenges. Choose your language, write code, and run against test cases.",
        icon: "💻",
        type: "coding",
        order: 2,
        timeLimit: comp.roundDurations?.[2] || 45,
        countdownDuration: 10,
        maxScore: 100,
        passingScore: 50,
        enabled: true,
        leaderboardEnabled: true,
        antiCheatEnabled: true,
        fullscreenRequired: false,
        tabDetectionEnabled: false,
        copyProtectionEnabled: false,
        autoSubmitOnTimeout: true,
        autoSubmitOnViolation: false,
        allowResubmission: false,
      },
      {
        id: "built_in_3",
        name: "Round 3 – Bug Hunter",
        description: "Review buggy code snippets, identify logic and syntax issues, and implement clean fixes.",
        icon: "🐛",
        type: "bug_hunter",
        order: 3,
        timeLimit: comp.roundDurations?.[3] || 20,
        countdownDuration: 10,
        maxScore: 100,
        passingScore: 50,
        enabled: true,
        leaderboardEnabled: true,
        antiCheatEnabled: true,
        fullscreenRequired: false,
        tabDetectionEnabled: false,
        copyProtectionEnabled: false,
        autoSubmitOnTimeout: true,
        autoSubmitOnViolation: false,
        allowResubmission: false,
      },
    ];
    Competition.update({ dynamicRounds: rounds } as any);
  }
  return rounds;
}

// ── GET /api/portal/public-info ──────────────────────────────────────
// Unauthenticated public route returning portal settings for frontend pages
router.get("/public-info", (req, res): void => {
  const comp = Competition.get();
  const dynamicRounds = getOrSeedDynamicRounds(comp);
  res.json({
    portalSettings: (comp as any).portalSettings || {},
    dynamicRounds,
    competitionState: comp.competitionState,
    currentRound: comp.currentRound,
    announcement: comp.announcement,
    broadcastMessage: comp.broadcastMessage,
  });
});

// ── GET /api/portal/settings ────────────────────────────────────────
// Returns current portal settings and dynamic rounds (admin only)
router.get("/settings", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const dynamicRounds = getOrSeedDynamicRounds(comp);
  res.json({
    portalSettings: (comp as any).portalSettings || {},
    dynamicRounds,
    publishedLeaderboards: (comp as any).publishedLeaderboards || {},
    countdownStartedAt: (comp as any).countdownStartedAt || {},
    roundDurations: comp.roundDurations || {},
    competitionState: comp.competitionState,
    currentRound: comp.currentRound,
    announcement: comp.announcement,
    broadcastMessage: comp.broadcastMessage,
    securitySettings: {
      fullscreenModeEnabled: comp.fullscreenModeEnabled,
      rightClickBlocked: comp.rightClickBlocked,
      copyPasteRestricted: comp.copyPasteRestricted,
      keyboardShortcutsBlocked: comp.keyboardShortcutsBlocked,
      devToolsDetectionEnabled: comp.devToolsDetectionEnabled,
      tabSwitchDetectionEnabled: comp.tabSwitchDetectionEnabled,
      autoSubmitOnTabSwitch: comp.autoSubmitOnTabSwitch,
      autoSubmitOnFullscreenExit: comp.autoSubmitOnFullscreenExit,
      singleDeviceLoginEnabled: comp.singleDeviceLoginEnabled,
    },
  });
});

// ── PATCH /api/portal/settings ──────────────────────────────────────
// Updates portal settings (general info, messages, leaderboard prefs)
router.patch("/settings", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const current = (comp as any).portalSettings || {};
  const patch = req.body as Partial<PortalSettings>;

  // Deep merge messages
  const merged: PortalSettings = {
    ...current,
    ...patch,
    messages: {
      ...current.messages,
      ...(patch.messages || {}),
    },
  };

  Competition.update({ portalSettings: merged } as any);
  if (req.user) ActivityLog.add(req.user.id, "PORTAL_SETTINGS_UPDATED", { fields: Object.keys(patch) });
  res.json({ message: "Portal settings updated.", portalSettings: merged });
});

// ── PATCH /api/portal/security ──────────────────────────────────────
// Updates security settings
router.patch("/security", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const {
    fullscreenModeEnabled,
    rightClickBlocked,
    copyPasteRestricted,
    keyboardShortcutsBlocked,
    devToolsDetectionEnabled,
    tabSwitchDetectionEnabled,
    autoSubmitOnTabSwitch,
    autoSubmitOnFullscreenExit,
    singleDeviceLoginEnabled,
  } = req.body;

  const update: Record<string, unknown> = {};
  if (fullscreenModeEnabled !== undefined) (update as any).fullscreenModeEnabled = !!fullscreenModeEnabled;
  if (rightClickBlocked !== undefined) (update as any).rightClickBlocked = !!rightClickBlocked;
  if (copyPasteRestricted !== undefined) (update as any).copyPasteRestricted = !!copyPasteRestricted;
  if (keyboardShortcutsBlocked !== undefined) (update as any).keyboardShortcutsBlocked = !!keyboardShortcutsBlocked;
  if (devToolsDetectionEnabled !== undefined) (update as any).devToolsDetectionEnabled = !!devToolsDetectionEnabled;
  if (tabSwitchDetectionEnabled !== undefined) (update as any).tabSwitchDetectionEnabled = !!tabSwitchDetectionEnabled;
  if (autoSubmitOnTabSwitch !== undefined) (update as any).autoSubmitOnTabSwitch = !!autoSubmitOnTabSwitch;
  if (autoSubmitOnFullscreenExit !== undefined) (update as any).autoSubmitOnFullscreenExit = !!autoSubmitOnFullscreenExit;
  if (singleDeviceLoginEnabled !== undefined) (update as any).singleDeviceLoginEnabled = !!singleDeviceLoginEnabled;

  Competition.update(update as any);
  if (req.user) ActivityLog.add(req.user.id, "SECURITY_SETTINGS_UPDATED", req.body);
  res.json({ message: "Security settings updated.", status: Competition.get() });
});

// ── PATCH /api/portal/round-durations ──────────────────────────────
// Updates round durations
router.patch("/round-durations", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const current = comp.roundDurations || {};
  const patches = req.body as Record<string, number>; // e.g. { "1": 30, "2": 45 }
  const merged = { ...current };
  Object.entries(patches).forEach(([k, v]) => { merged[Number(k)] = Number(v); });
  Competition.update({ roundDurations: merged } as any);
  if (req.user) ActivityLog.add(req.user.id, "ROUND_DURATIONS_UPDATED", patches);
  res.json({ message: "Round durations updated.", roundDurations: merged });
});

// ── GET /api/portal/rounds ──────────────────────────────────────────
// Returns all dynamic rounds (admin only) — seeds built-in rounds if empty
router.get("/rounds", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const dynamicRounds = getOrSeedDynamicRounds(comp);
  res.json({ dynamicRounds });
});

// ── POST /api/portal/rounds ──────────────────────────────────────────
// Creates a new dynamic round
router.post("/rounds", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const rounds: DynamicRound[] = (comp as any).dynamicRounds || [];
  const newRound: DynamicRound = {
    id: uuidv4(),
    name: req.body.name || "New Round",
    description: req.body.description || "",
    icon: req.body.icon || "🏁",
    type: req.body.type || "mcq",
    order: rounds.length + 1,
    timeLimit: Number(req.body.timeLimit || 30),
    countdownDuration: Number(req.body.countdownDuration || 10),
    maxScore: Number(req.body.maxScore || 100),
    passingScore: Number(req.body.passingScore || 50),
    enabled: req.body.enabled !== false,
    leaderboardEnabled: req.body.leaderboardEnabled !== false,
    antiCheatEnabled: req.body.antiCheatEnabled !== false,
    fullscreenRequired: !!req.body.fullscreenRequired,
    tabDetectionEnabled: !!req.body.tabDetectionEnabled,
    copyProtectionEnabled: !!req.body.copyProtectionEnabled,
    autoSubmitOnTimeout: req.body.autoSubmitOnTimeout !== false,
    autoSubmitOnViolation: !!req.body.autoSubmitOnViolation,
    allowResubmission: !!req.body.allowResubmission,
  };
  rounds.push(newRound);
  Competition.update({ dynamicRounds: rounds } as any);
  if (req.user) ActivityLog.add(req.user.id, "DYNAMIC_ROUND_CREATED", { roundId: newRound.id, name: newRound.name });
  res.status(201).json({ message: "Round created.", round: newRound });
});

// ── PUT /api/portal/rounds/:id ──────────────────────────────────────
// Updates a dynamic round
router.put("/rounds/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const rounds: DynamicRound[] = (comp as any).dynamicRounds || [];
  const idx = rounds.findIndex((r) => r.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Round not found." }); return; }
  rounds[idx] = { ...rounds[idx], ...req.body, id: req.params.id };
  Competition.update({ dynamicRounds: rounds } as any);
  if (req.user) ActivityLog.add(req.user.id, "DYNAMIC_ROUND_UPDATED", { roundId: req.params.id });
  res.json({ message: "Round updated.", round: rounds[idx] });
});

// ── DELETE /api/portal/rounds/:id ──────────────────────────────────
// Deletes a dynamic round
router.delete("/rounds/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const rounds: DynamicRound[] = (comp as any).dynamicRounds || [];
  const filtered = rounds.filter((r) => r.id !== req.params.id);
  if (filtered.length === rounds.length) { res.status(404).json({ message: "Round not found." }); return; }
  Competition.update({ dynamicRounds: filtered } as any);
  if (req.user) ActivityLog.add(req.user.id, "DYNAMIC_ROUND_DELETED", { roundId: req.params.id });
  res.json({ message: "Round deleted." });
});

// ── PATCH /api/portal/rounds/reorder ───────────────────────────────
// Reorders rounds (pass array of {id, order})
router.patch("/rounds/reorder", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const rounds: DynamicRound[] = (comp as any).dynamicRounds || [];
  const orders: Array<{ id: string; order: number }> = req.body.orders || [];
  orders.forEach(({ id, order }) => {
    const r = rounds.find((r) => r.id === id);
    if (r) r.order = order;
  });
  rounds.sort((a, b) => a.order - b.order);
  Competition.update({ dynamicRounds: rounds } as any);
  if (req.user) ActivityLog.add(req.user.id, "DYNAMIC_ROUNDS_REORDERED", {});
  res.json({ message: "Rounds reordered.", dynamicRounds: rounds });
});

// ── POST /api/portal/ai-generate-round ─────────────────────────────
// Generates a complete round draft based on prompt
router.post("/ai-generate-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { prompt } = req.body;
  const text = (prompt || "").toLowerCase();

  let type: DynamicRound["type"] = "mcq";
  let icon = "⚡";
  let name = "AI Generated Challenge";
  let description = "Automatically generated competition round based on prompt specification.";
  let timeLimit = 30;
  let maxScore = 100;
  let passingScore = 50;

  if (text.includes("coding") || text.includes("code") || text.includes("java") || text.includes("python") || text.includes("c++")) {
    type = "coding";
    icon = "💻";
    name = text.includes("java") ? "Java Coding Challenge" : text.includes("python") ? "Python Algorithm Battle" : "Algorithmic Coding Round";
    description = "Write clean, optimal code to solve algorithmic problems with strict time and memory constraints.";
    timeLimit = 45;
  } else if (text.includes("debug") || text.includes("bug")) {
    type = "bug_hunter";
    icon = "🐛";
    name = "Bug Hunter & Code Fix";
    description = "Identify syntax bugs, logical flaws, and edge-case failures in broken code snippets.";
    timeLimit = 30;
  } else if (text.includes("aptitude") || text.includes("math") || text.includes("reasoning")) {
    type = "mcq";
    icon = "🧠";
    name = "Aptitude & Logical Reasoning";
    description = "Test analytical, mathematical, and logical problem-solving skills under strict time pressure.";
    timeLimit = 20;
  } else if (text.includes("rapid") || text.includes("speed")) {
    type = "rapid_fire";
    icon = "🔥";
    name = "Rapid Fire Blitz";
    description = "Quick-fire technical questions designed to test instant recall and foundational concepts.";
    timeLimit = 15;
  }

  // Generate draft questions array
  const sampleQuestions = Array.from({ length: 5 }, (_, i) => {
    if (type === "coding") {
      return {
        id: `ai_q_${i + 1}`,
        title: `Problem ${i + 1}: ${name} Task`,
        problemStatement: `Implement a function that processes input according to specifications for Task ${i + 1}.`,
        inputFormat: "First line contains N. Second line contains N space-separated integers.",
        outputFormat: "Print the computed result on a single line.",
        constraints: "1 <= N <= 10^5",
        sampleInput: "5\n1 2 3 4 5",
        sampleOutput: "15",
        difficulty: i < 2 ? "easy" : i < 4 ? "medium" : "hard",
        marks: (i + 1) * 20,
      };
    } else if (type === "bug_hunter") {
      return {
        id: `ai_q_${i + 1}`,
        title: `Bug Fix ${i + 1}: Unhandled Exception`,
        buggyCode: `// Fix the bug in Task ${i + 1}\nfunction solve(arr) {\n  let sum = 0;\n  for(let i=0; i<=arr.length; i++) {\n    sum += arr[i];\n  }\n  return sum;\n}`,
        language: "javascript",
        difficulty: i < 2 ? "easy" : "medium",
        marks: 20,
      };
    } else {
      return {
        id: `ai_q_${i + 1}`,
        questionText: `Technical Question ${i + 1} regarding ${name}?`,
        options: ["Option A (Correct)", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        difficulty: i < 2 ? "easy" : "medium",
        marks: 20,
      };
    }
  });

  res.json({
    draft: {
      name,
      description,
      type,
      icon,
      timeLimit,
      countdownDuration: 10,
      maxScore,
      passingScore,
      enabled: true,
      leaderboardEnabled: true,
      antiCheatEnabled: true,
      fullscreenRequired: true,
      tabDetectionEnabled: true,
      copyProtectionEnabled: true,
      autoSubmitOnTimeout: true,
      autoSubmitOnViolation: false,
      allowResubmission: true,
      questions: sampleQuestions,
    },
  });
});

// ── GET /api/portal/templates ──────────────────────────────────────
// Returns built-in + saved round templates
router.get("/templates", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const saved = (comp as any).portalSettings?.savedTemplates || [];

  const builtIn: RoundTemplate[] = [
    {
      id: "tmpl_mcq_standard",
      name: "Standard MCQ Quiz",
      type: "mcq",
      description: "Multiple choice questions with 4 options and automatic scoring.",
      icon: "❓",
      timeLimit: 30,
      maxScore: 100,
      passingScore: 50,
      questionSchema: { optionsCount: 4, scoringType: "auto" },
      isBuiltIn: true,
    },
    {
      id: "tmpl_coding_challenge",
      name: "Competitive Coding Challenge",
      type: "coding",
      description: "Algorithmic coding problems with automated test case evaluation and multi-language support.",
      icon: "💻",
      timeLimit: 45,
      maxScore: 100,
      passingScore: 60,
      questionSchema: { compilerRequired: true, hiddenTestCases: true },
      isBuiltIn: true,
    },
    {
      id: "tmpl_bug_hunter",
      name: "Bug Hunter & Code Fix",
      type: "bug_hunter",
      description: "Identify syntax errors and logical flaws in broken code snippets.",
      icon: "🐛",
      timeLimit: 30,
      maxScore: 100,
      passingScore: 50,
      questionSchema: { sideBySideDiff: true },
      isBuiltIn: true,
    },
    {
      id: "tmpl_rapid_fire",
      name: "Rapid Fire Blitz",
      type: "rapid_fire",
      description: "Fast-paced quiz round with strict short timer per question.",
      icon: "🔥",
      timeLimit: 15,
      maxScore: 100,
      passingScore: 60,
      questionSchema: { perQuestionTimer: 30 },
      isBuiltIn: true,
    },
  ];

  res.json({ templates: [...builtIn, ...saved] });
});

// ── POST /api/portal/templates ──────────────────────────────────────
// Saves a new round template
router.post("/templates", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const settings: PortalSettings = (comp as any).portalSettings || {};
  const currentTemplates = settings.savedTemplates || [];

  const newTmpl: RoundTemplate = {
    id: `tmpl_${uuidv4().slice(0, 8)}`,
    name: req.body.name || "Custom Round Template",
    type: req.body.type || "custom",
    description: req.body.description || "",
    icon: req.body.icon || "🏁",
    timeLimit: Number(req.body.timeLimit) || 30,
    maxScore: Number(req.body.maxScore) || 100,
    passingScore: Number(req.body.passingScore) || 50,
    questionSchema: req.body.questionSchema || {},
    sampleQuestions: req.body.sampleQuestions || [],
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  };

  const updatedTemplates = [...currentTemplates, newTmpl];
  Competition.update({ portalSettings: { ...settings, savedTemplates: updatedTemplates } } as any);
  if (req.user) ActivityLog.add(req.user.id, "ROUND_TEMPLATE_SAVED", { templateName: newTmpl.name });

  res.status(201).json({ message: "Template saved.", template: newTmpl });
});

// ── GET /api/portal/backup ──────────────────────────────────────────
// Downloads full lowdb database as JSON backup
router.get("/backup", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const fullData = db.getState();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=code_crackers_backup_${timestamp}.json`);
  res.send(JSON.stringify(fullData, null, 2));
});

// ── POST /api/portal/restore ─────────────────────────────────────────
// Restores database from uploaded JSON payload
router.post("/restore", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== "object" || !backupData.competition) {
      res.status(400).json({ message: "Invalid backup JSON format. Required root keys missing." });
      return;
    }
    db.setState(backupData);
    db.write();
    if (req.user) ActivityLog.add(req.user.id, "DATABASE_RESTORED", { timestamp: new Date().toISOString() });
    res.json({ message: "Portal data restored successfully.", status: Competition.get() });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to restore backup.", error: error.message });
  }
});

export default router;

