import { Router, Response } from "express";
import { Competition, ActivityLog, Users, Submissions, CodeSubmissions, DebugSubmissions, QuestionsMCQ } from "../config/database";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// ── GET /api/competition/status ──────────────────────────────────────
// Participants & admin both use this to sync competition state
router.get("/status", authenticateToken, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  let userStatus = null;
  if (req.user) {
    const user = Users.findById(req.user.id);
    if (user) {
      userStatus = {
        isApproved: user.isApproved,
        isLocked: user.isLocked,
        loginEnabled: user.loginEnabled,
        qualificationStatus: user.qualificationStatus || "waiting",
        roundPermissions: user.roundPermissions || {},
        timerExtensionSeconds: user.timerExtensionSeconds || 0,
      };
    }
  }
  res.json({
    ...comp,
    serverTime: new Date().toISOString(),
    user: userStatus,
  });
});

// ── POST /api/competition/start ──────────────────────────────────────
router.post("/start", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { durationMinutes = 30 } = req.body;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const comp = Competition.get();
  const currentDurations = comp.roundDurations || { 1: 30, 2: 45, 3: 20 };
  const currentStartedAt = comp.roundStartedAt || {};

  Competition.update({
    competitionState: "running",
    roundStatus: "open",
    currentRound: 1,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    roundDurations: { ...currentDurations, 1: Number(durationMinutes) },
    roundStartedAt: { ...currentStartedAt, 1: now.toISOString() },
  });

  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_START", { durationMinutes });
  res.json({ message: "Competition started.", status: Competition.get() });
});

// ── POST /api/competition/pause ──────────────────────────────────────
router.post("/pause", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({ competitionState: "paused" });
  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_PAUSE", {});
  res.json({ message: "Competition paused.", status: Competition.get() });
});

// ── POST /api/competition/resume ─────────────────────────────────────
router.post("/resume", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({ competitionState: "running" });
  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_RESUME", {});
  res.json({ message: "Competition resumed.", status: Competition.get() });
});

// ── POST /api/competition/stop ───────────────────────────────────────
router.post("/stop", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({ competitionState: "ended", roundStatus: "closed" });
  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_STOP", {});
  res.json({ message: "Competition stopped.", status: Competition.get() });
});

// ── POST /api/competition/reset ──────────────────────────────────────
router.post("/reset", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({
    currentRound: 0,
    roundStatus: "locked",
    competitionState: "idle",
    startedAt: null,
    endsAt: null,
    roundStartedAt: { 1: null, 2: null, 3: null },
  });
  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_RESET", {});
  res.json({ message: "Competition reset.", status: Competition.get() });
});

// ── POST /api/competition/open-round ────────────────────────────────
// Puts participants in Waiting Room for specified round (does not start timer yet)
router.post("/open-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { round, roundId, durationMinutes = 30 } = req.body;
  const comp = Competition.get();
  const targetRoundId = roundId ? String(roundId) : (round !== undefined ? String(round) : "built_in_1");
  const roundNum = typeof round === "number" ? round : Number(targetRoundId) || 1;
  const currentDurations = comp.roundDurations || {};
  const currentStartedAt = comp.roundStartedAt || {};

  Competition.update({
    currentRound: roundNum,
    currentRoundId: targetRoundId,
    roundStatus: "open",
    competitionState: "idle", // Participants wait in Waiting Room until admin starts round
    roundDurations: { ...currentDurations, [roundNum]: Number(durationMinutes), [targetRoundId as any]: Number(durationMinutes) },
    roundStartedAt: { ...currentStartedAt, [roundNum]: null, [targetRoundId as any]: null },
  } as any);

  if (req.user) ActivityLog.add(req.user.id, "ROUND_OPEN", { round: roundNum, roundId: targetRoundId, durationMinutes });
  res.json({ message: `Round ${targetRoundId} opened. Participants are now in waiting room.`, status: Competition.get() });
});

// ── POST /api/competition/start-round ───────────────────────────────
// Admin explicitly clicks "Start Round" — triggers 10-second server-synced countdown
router.post("/start-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const comp = Competition.get();
  const targetRoundId = req.body.roundId ? String(req.body.roundId) : (req.body.round !== undefined ? String(req.body.round) : ((comp as any).currentRoundId || String(comp.currentRound || "built_in_1")));
  const roundNum = typeof req.body.round === "number" ? req.body.round : Number(targetRoundId) || comp.currentRound || 1;
  const currentDurations = comp.roundDurations || {};
  const durationMinutes = Number(req.body.durationMinutes || currentDurations[roundNum] || currentDurations[targetRoundId as any] || 30);
  const countdownSeconds = 10; // 10-second server-synced countdown

  const now = new Date();
  // Round actually starts after countdown finishes
  const roundStartsAt = new Date(now.getTime() + countdownSeconds * 1000);
  const endsAt = new Date(roundStartsAt.getTime() + durationMinutes * 60 * 1000);
  const currentStartedAt = comp.roundStartedAt || {};
  const currentCountdown = (comp as any).countdownStartedAt || {};

  Competition.update({
    currentRound: roundNum,
    currentRoundId: targetRoundId,
    roundStatus: "open",
    competitionState: "running",
    startedAt: roundStartsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    roundDurations: { ...currentDurations, [roundNum]: durationMinutes, [targetRoundId as any]: durationMinutes },
    roundStartedAt: { ...currentStartedAt, [roundNum]: roundStartsAt.toISOString(), [targetRoundId as any]: roundStartsAt.toISOString() },
    countdownStartedAt: { ...currentCountdown, [roundNum]: now.toISOString(), [targetRoundId as any]: now.toISOString() },
  } as any);

  if (req.user) ActivityLog.add(req.user.id, "ROUND_START_EXPLICIT", { round: roundNum, roundId: targetRoundId, durationMinutes, countdownStartedAt: now.toISOString(), roundStartedAt: roundStartsAt.toISOString() });
  res.json({ message: `Round ${targetRoundId} started! 10-second countdown active.`, status: Competition.get() });
});

// ── POST /api/competition/close-round ───────────────────────────────
router.post("/close-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({ roundStatus: "closed", competitionState: "ended" });
  if (req.user) ActivityLog.add(req.user.id, "ROUND_CLOSE", {});
  res.json({ message: "Round closed.", status: Competition.get() });
});

// ── POST /api/competition/violation ─────────────────────────────────
// Log security / anti-cheating violation from participant frontend
router.post("/violation", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const user = Users.findById(req.user.id);
    const { type, round, details } = req.body;

    ActivityLog.add(req.user.id, "VIOLATION", {
      username: user?.username || req.user.username,
      fullName: user?.fullName || "",
      type: type || "UNKNOWN_VIOLATION",
      round: round || Competition.get().currentRound || 1,
      details: details || "",
      timestamp: new Date().toISOString(),
    });

    res.json({ message: "Violation logged successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error logging violation." });
  }
});

// ── GET /api/competition/online-count ───────────────────────────────
// Returns count of users with active session tokens (approx. online)
router.get("/online-count", authenticateToken, (req: AuthRequest, res: Response): void => {
  const users = Users.findAll();
  const onlineCount = users.filter((u) => u.currentSessionToken !== null).length;
  res.json({ onlineCount, totalParticipants: users.filter((u) => u.role === "participant").length });
});

// ── POST /api/competition/settings ──────────────────────────────────
router.post("/settings", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const patch = req.body;
    Competition.update(patch);
    if (req.user) ActivityLog.add(req.user.id, "UPDATE_SETTINGS", patch);
    res.json({ message: "Competition settings updated.", status: Competition.get() });
  } catch (error) {
    res.status(500).json({ message: "Server error updating settings." });
  }
});

// ── POST /api/competition/announcement ──────────────────────────────
router.post("/announcement", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { announcement } = req.body;
  Competition.update({ announcement });
  if (req.user) ActivityLog.add(req.user.id, "PUBLISH_ANNOUNCEMENT", { announcement });
  res.json({ message: "Announcement published.", status: Competition.get() });
});

// ── POST /api/competition/broadcast ──────────────────────────────────
router.post("/broadcast", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { message } = req.body;
  Competition.update({ broadcastMessage: message });
  if (req.user) ActivityLog.add(req.user.id, "BROADCAST_MESSAGE", { message });
  res.json({ message: "Message broadcasted.", status: Competition.get() });
});

// ── POST /api/competition/leaderboard/publish ────────────────────────
// Admin publishes or hides the leaderboard for a specific round ("1", "2", "3", "overall")
router.post("/leaderboard/publish", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { round, published } = req.body;
  if (!round) { res.status(400).json({ message: "round field required" }); return; }
  const comp = Competition.get();
  const currentLeaderboards = (comp as any).publishedLeaderboards || {};
  Competition.update({ publishedLeaderboards: { ...currentLeaderboards, [round]: !!published } } as any);
  if (req.user) ActivityLog.add(req.user.id, published ? "LEADERBOARD_PUBLISHED" : "LEADERBOARD_HIDDEN", { round });
  res.json({ message: `Leaderboard for ${round} ${published ? 'published' : 'hidden'}.`, status: Competition.get() });
});

// ── GET /api/competition/leaderboard ────────────────────────────────
// Returns leaderboard for a round. Participants can only see it if published.
router.get("/leaderboard", authenticateToken, (req: AuthRequest, res: Response): void => {
  const round = String(req.query.round || "overall");
  const comp = Competition.get();
  const publishedLeaderboards = (comp as any).publishedLeaderboards || {};
  const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin";

  if (!isAdmin && !publishedLeaderboards[round]) {
    res.json({ published: false, leaderboard: [] });
    return;
  }

  // Compute leaderboard across all dynamic rounds
  const allUsers = Users.findAll().filter((u) => u.role === "participant" && u.isApproved);
  const allMCQQuestions = QuestionsMCQ.findAll();
  const portalSettings = (comp as any).portalSettings || {};
  const rankingMethod = portalSettings.leaderboardRankingMethod || "score_then_time";
  const dynamicRounds = (comp as any).dynamicRounds || [];

  const ranked = allUsers.map((user) => {
    let totalScore = 0;
    const roundScores: Record<string, number> = {};

    // 1. Built-in Round 1 or MCQ submissions
    const sub1 = Submissions.findOne({ userId: user.id });
    let r1Score = 0;
    if (sub1) {
      Object.entries(sub1.answerData).forEach(([qId, data]) => {
        const q = allMCQQuestions.find((mcq) => mcq.id === qId);
        if (q && data.answer === q.correctAnswer) r1Score++;
      });
    }
    if (user.scoreOverrides?.[1] !== undefined) r1Score = user.scoreOverrides[1];
    roundScores["1"] = r1Score;
    roundScores["built_in_1"] = r1Score;

    // 2. Built-in Round 2 (Coding)
    const sub2 = CodeSubmissions.findOne({ userId: user.id });
    let r2Score = 0;
    if (sub2) r2Score = Object.keys(sub2.answerData).length * 10;
    if (user.scoreOverrides?.[2] !== undefined) r2Score = user.scoreOverrides[2];
    roundScores["2"] = r2Score;
    roundScores["built_in_2"] = r2Score;

    // 3. Built-in Round 3 (Bug Hunter)
    const sub3 = DebugSubmissions.findOne({ userId: user.id });
    let r3Score = 0;
    if (sub3) r3Score = Object.values(sub3.answerData).reduce((sum, a) => sum + ((a as any).pointsEarned || 0), 0);
    if (user.scoreOverrides?.[3] !== undefined) r3Score = user.scoreOverrides[3];
    roundScores["3"] = r3Score;
    roundScores["built_in_3"] = r3Score;

    // Sum overall score from all active dynamic rounds
    if (dynamicRounds.length > 0) {
      dynamicRounds.forEach((dr: any, idx: number) => {
        const key = dr.id || String(idx + 1);
        const score = roundScores[key] ?? roundScores[String(dr.order)] ?? roundScores[`built_in_${dr.order}`] ?? 0;
        totalScore += score;
      });
    } else {
      totalScore = r1Score + r2Score + r3Score;
    }

    const roundScore = round === "overall" ? totalScore : (roundScores[round] ?? roundScores[`built_in_${round}`] ?? 0);

    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      college: user.college || "",
      department: user.department || "",
      score: roundScore,
      totalScore,
      r1Score, r2Score, r3Score,
      roundScores,
      timeTakenSeconds: null,
      qualificationStatus: user.qualificationStatus || "waiting",
    };
  });

  // Sort by score desc
  ranked.sort((a, b) => b.score - a.score);

  res.json({ published: true, round, leaderboard: ranked.map((p, i) => ({ ...p, rank: i + 1 })) });
});

export default router;
