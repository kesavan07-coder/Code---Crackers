import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { QuestionsMCQ, Submissions, Competition, ActivityLog, Users } from "../config/database";

const router = Router();

// ── GET /api/round1/questions ────────────────────────────────────────
// Participants fetch questions + their current submission state
router.get("/questions", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const comp = Competition.get();

    // Check if competition is running and current round is 1
    if (comp.currentRound !== 1 || comp.roundStatus !== "open") {
      res.status(403).json({ message: "Round 1 is not active." });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const userId = req.user.id;

    // Fetch questions and strip correct answers to prevent inspect-cheat
    const rawQuestions = QuestionsMCQ.findAll();
    const questions = rawQuestions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      difficulty: q.difficulty,
      order: q.order,
    }));

    // Find or initialize submission record
    let submission = Submissions.findOne({ userId, roundId: 1 });
    if (!submission) {
      // Create empty initial structure: { "q_id": { answer: null, markedForReview: false } }
      const initialAnswerData: Record<string, { answer: number | null; markedForReview: boolean }> = {};
      rawQuestions.forEach((q) => {
        initialAnswerData[q.id] = { answer: null, markedForReview: false };
      });

      submission = Submissions.create({
        userId,
        roundId: 1,
        answerData: initialAnswerData,
        submittedAt: null,
        status: "in_progress",
        tabSwitchCount: 0,
      });
    }

    res.json({
      questions,
      submission: {
        answerData: submission.answerData,
        submittedAt: submission.submittedAt,
        status: submission.status,
        tabSwitchCount: submission.tabSwitchCount,
      },
      endsAt: comp.endsAt,
    });
  } catch (error) {
    console.error("Fetch round 1 error:", error);
    res.status(500).json({ message: "Server error loading questions." });
  }
});

// ── POST /api/round1/save ────────────────────────────────────────────
// Auto-saves current answers progress
router.post("/save", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const userId = req.user.id;
    const { answerData } = req.body;

    const comp = Competition.get();
    if (comp.currentRound !== 1 || comp.roundStatus !== "open") {
      res.status(403).json({ message: "Round 1 is not open." });
      return;
    }

    const submission = Submissions.findOne({ userId, roundId: 1 });
    if (!submission) {
      res.status(404).json({ message: "Submission record not found." });
      return;
    }

    if (submission.status === "submitted") {
      res.status(400).json({ message: "Round already submitted. Progress locked." });
      return;
    }

    Submissions.update(submission.id, { answerData });
    res.json({ success: true, message: "Progress saved." });
  } catch (error) {
    console.error("Save round 1 error:", error);
    res.status(500).json({ message: "Server error saving progress." });
  }
});

// ── POST /api/round1/submit ──────────────────────────────────────────
// Finalizes submission and locks editing. Accepts optional answerData to
// atomically save latest answers and submission status in a single DB write.
router.post("/submit", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const userId = req.user.id;
    const { answerData } = req.body || {};
    const submission = Submissions.findOne({ userId, roundId: 1 });

    if (!submission) {
      res.status(404).json({ message: "Submission record not found." });
      return;
    }

    if (submission.status === "submitted") {
      res.status(400).json({ message: "Round already submitted." });
      return;
    }

    // Atomically save latest answers + mark as submitted in one DB write
    Submissions.update(submission.id, {
      ...(answerData ? { answerData } : {}),
      status: "submitted",
      submittedAt: new Date().toISOString(),
    });

    // Lock round 1 as completed for this participant
    const user = Users.findById(userId);
    if (user) {
      const currentPerms = user.roundPermissions || {};
      Users.update(userId, {
        roundPermissions: { ...currentPerms, 1: "completed" },
      });
    }

    ActivityLog.add(userId, "ROUND1_SUBMIT", {
      tabSwitches: submission.tabSwitchCount,
    });

    res.json({ success: true, message: "Round 1 successfully submitted." });
  } catch (error) {
    console.error("Submit round 1 error:", error);
    res.status(500).json({ message: "Server error submitting round." });
  }
});

// ── POST /api/round1/tab-switch ──────────────────────────────────────
// Log cheat/tab-switching event
router.post("/tab-switch", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const userId = req.user.id;
    const submission = Submissions.findOne({ userId, roundId: 1 });

    if (!submission) {
      res.status(404).json({ message: "Submission not found." });
      return;
    }

    if (submission.status === "submitted") {
      res.status(400).json({ message: "Round already submitted." });
      return;
    }

    const newCount = submission.tabSwitchCount + 1;
    Submissions.update(submission.id, { tabSwitchCount: newCount });

    ActivityLog.add(userId, "TAB_SWITCH", {
      round: 1,
      totalSwitches: newCount,
    });

    let disqualified = false;
    if (newCount >= 2) {
      disqualified = true;
      Submissions.update(submission.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
      const user = Users.findById(userId);
      if (user) {
        const currentPerms = user.roundPermissions || {};
        Users.update(userId, {
          roundPermissions: { ...currentPerms, 1: "disqualified" },
          currentSessionToken: null,
          qualificationStatus: "eliminated",
        });
      }
      ActivityLog.add(userId, "DISQUALIFIED", { round: 1, reason: "Excessive tab switching" });
    }

    res.json({ success: true, tabSwitchCount: newCount, disqualified });
  } catch (error) {
    console.error("Log tab switch error:", error);
    res.status(500).json({ message: "Server error logging event." });
  }
});

export default router;
