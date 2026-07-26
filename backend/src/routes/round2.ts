import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { QuestionsCoding, CodeSubmissions, Competition, ActivityLog, Users } from "../config/database";
import { executeCode } from "../services/codeRunner";

const router = Router();

// ── POST /api/round2/run ──────────────────────────────────────────────
router.post("/run", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { questionId, code, language } = req.body;

    if (!questionId || code === undefined || !language) {
      res.status(400).json({ message: "Missing questionId, code, or language." });
      return;
    }

    const question = QuestionsCoding.findById(questionId);
    if (!question) {
      res.status(404).json({ message: "Question not found." });
      return;
    }

    // Run code against the visible test cases
    const results = await executeCode(code, language, question.visibleTestCases);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: "Server error running code.", error: error.message });
  }
});

// ── GET /api/round2/questions ─────────────────────────────────────────
// Returns questions without hidden test cases
router.get("/questions", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const comp = Competition.get();
    if (comp.currentRound < 2 || comp.competitionState === "idle") {
      res.status(403).json({ message: "Round 2 is not currently active." });
      return;
    }

    const questions = QuestionsCoding.findAll().map((q) => ({
      id: q.id,
      title: q.title,
      story: q.story,
      examples: q.examples,
      constraints: q.constraints,
      visibleTestCases: q.visibleTestCases,
      difficulty: q.difficulty,
      order: q.order,
      timeLimit: q.timeLimit,
      memoryLimit: q.memoryLimit,
    }));

    const submission = CodeSubmissions.findOne({ userId: req.user!.id, roundId: 2 });

    res.json({
      questions,
      endsAt: comp.endsAt,
      submission: submission
        ? {
            status: submission.status,
            answerData: submission.answerData,
            tabSwitchCount: submission.tabSwitchCount || 0,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error loading Round 2 questions." });
  }
});

// ── POST /api/round2/save ─────────────────────────────────────────────
// Auto-saves code draft for a specific question
router.post("/save", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const { questionId, code, language } = req.body;

    if (!questionId || code === undefined || !language) {
      res.status(400).json({ message: "Missing questionId, code, or language." });
      return;
    }

    const userId = req.user!.id;
    let submission = CodeSubmissions.findOne({ userId, roundId: 2 });

    const newEntry = {
      code,
      language,
      lastSaved: new Date().toISOString(),
      isSubmitted: false,
    };

    if (!submission) {
      submission = CodeSubmissions.create({
        userId,
        roundId: 2,
        answerData: { [questionId]: newEntry },
        submittedAt: null,
        status: "in_progress",
      });
    } else {
      if (submission.status === "submitted") {
        res.status(403).json({ message: "Round 2 already submitted." });
        return;
      }
      const updatedAnswerData = {
        ...submission.answerData,
        [questionId]: {
          ...submission.answerData[questionId],
          ...newEntry,
        },
      };
      CodeSubmissions.update(submission.id, { answerData: updatedAnswerData });
    }

    res.json({ message: "Code saved.", savedAt: newEntry.lastSaved });
  } catch (error) {
    res.status(500).json({ message: "Server error saving code." });
  }
});

// ── POST /api/round2/submit ───────────────────────────────────────────
// Final submission — locks all code
router.post("/submit", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const comp = Competition.get();

    if (comp.currentRound < 2 || comp.roundStatus === "closed") {
      res.status(403).json({ message: "Round 2 is not open for submission." });
      return;
    }

    let submission = CodeSubmissions.findOne({ userId, roundId: 2 });

    if (!submission) {
      // Submit with empty answers
      submission = CodeSubmissions.create({
        userId,
        roundId: 2,
        answerData: {},
        submittedAt: new Date().toISOString(),
        status: "submitted",
      });
    } else {
      if (submission.status === "submitted") {
        res.status(409).json({ message: "Round 2 already submitted." });
        return;
      }

      // Mark all saved answers as submitted
      const finalAnswers = Object.fromEntries(
        Object.entries(submission.answerData).map(([qId, data]) => [
          qId,
          { ...data, isSubmitted: true },
        ])
      );

      CodeSubmissions.update(submission.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
        answerData: finalAnswers,
      });
    }

    // Lock round 2 as completed for this participant
    const user = Users.findById(userId);
    if (user) {
      const currentPerms = user.roundPermissions || {};
      Users.update(userId, {
        roundPermissions: { ...currentPerms, 2: "completed" },
      });
    }

    ActivityLog.add(userId, "ROUND2_SUBMIT", { questionCount: Object.keys(submission.answerData).length });

    res.json({ message: "Round 2 submitted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error submitting Round 2." });
  }
});

// ── GET /api/round2/status ────────────────────────────────────────────
// Returns participant's current submission status
router.get("/status", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const submission = CodeSubmissions.findOne({ userId: req.user!.id, roundId: 2 });
    const comp = Competition.get();
    res.json({
      status: submission?.status || "not_started",
      endsAt: comp.endsAt,
      answerData: submission?.answerData || {},
    });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/round2/tab-switch ──────────────────────────────────────
router.post("/tab-switch", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    let submission = CodeSubmissions.findOne({ userId, roundId: 2 });

    if (!submission) {
      submission = CodeSubmissions.create({
        userId,
        roundId: 2,
        answerData: {},
        submittedAt: null,
        status: "in_progress",
        tabSwitchCount: 0,
      });
    }

    if (submission.status === "submitted") {
      res.status(400).json({ message: "Round already submitted." });
      return;
    }

    const newCount = (submission.tabSwitchCount || 0) + 1;
    CodeSubmissions.update(submission.id, { tabSwitchCount: newCount });

    ActivityLog.add(userId, "TAB_SWITCH", {
      round: 2,
      totalSwitches: newCount,
    });

    let disqualified = false;
    if (newCount >= 2) {
      disqualified = true;
      CodeSubmissions.update(submission.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
      const user = Users.findById(userId);
      if (user) {
        const currentPerms = user.roundPermissions || {};
        Users.update(userId, {
          roundPermissions: { ...currentPerms, 2: "disqualified" },
          currentSessionToken: null,
          qualificationStatus: "eliminated",
        });
      }
      ActivityLog.add(userId, "DISQUALIFIED", { round: 2, reason: "Excessive tab switching" });
    }

    res.json({ success: true, tabSwitchCount: newCount, disqualified });
  } catch (error) {
    res.status(500).json({ message: "Server error logging event." });
  }
});

export default router;
