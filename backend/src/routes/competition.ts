import { Router, Response } from "express";
import { Competition, ActivityLog, Users } from "../config/database";
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
    user: userStatus,
  });
});

// ── POST /api/competition/start ──────────────────────────────────────
router.post("/start", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { durationMinutes = 30 } = req.body;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const currentDurations = Competition.get().roundDurations || { 1: 30, 2: 45, 3: 20 };

  Competition.update({
    competitionState: "running",
    roundStatus: "open",
    currentRound: 1,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    roundDurations: { ...currentDurations, 1: Number(durationMinutes) },
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
  });
  if (req.user) ActivityLog.add(req.user.id, "COMPETITION_RESET", {});
  res.json({ message: "Competition reset.", status: Competition.get() });
});

// ── POST /api/competition/open-round ────────────────────────────────
router.post("/open-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { round, durationMinutes = 30 } = req.body;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const currentDurations = Competition.get().roundDurations || { 1: 30, 2: 45, 3: 20 };

  Competition.update({
    currentRound: Number(round),
    roundStatus: "open",
    competitionState: "running",
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    roundDurations: { ...currentDurations, [Number(round)]: Number(durationMinutes) },
  });

  if (req.user) ActivityLog.add(req.user.id, "ROUND_OPEN", { round, durationMinutes });
  res.json({ message: `Round ${round} opened.`, status: Competition.get() });
});

// ── POST /api/competition/close-round ───────────────────────────────
router.post("/close-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  Competition.update({ roundStatus: "closed" });
  if (req.user) ActivityLog.add(req.user.id, "ROUND_CLOSE", {});
  res.json({ message: "Round closed.", status: Competition.get() });
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

export default router;
