import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { QuestionsDebug, DebugSubmissions, Competition, ActivityLog, Users } from "../config/database";
import { executeCode } from "../services/codeRunner";

const router = Router();

// ── GET /api/round3/questions ─────────────────────────────────────────
// Returns questions without fixedCode (hidden answer)
router.get("/questions", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const comp = Competition.get();
    if (comp.currentRound < 3 || comp.competitionState === "idle") {
      res.status(403).json({ message: "Round 3 is not currently active." });
      return;
    }

    const questions = QuestionsDebug.findAll().map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      buggyCode: q.buggyCode,
      language: q.language,
      hints: q.hints,
      points: q.points,
      difficulty: q.difficulty,
      order: q.order,
      // fixedCode is intentionally excluded from participant view
    }));

    const submission = DebugSubmissions.findOne({ userId: req.user!.id, roundId: 3 });

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
    res.status(500).json({ message: "Server error loading Round 3 questions." });
  }
});

// ── POST /api/round3/save ─────────────────────────────────────────────
// Autosaves the participant's fixed code for a specific question
router.post("/save", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const { questionId, fixedCode, language } = req.body;

    if (!questionId || fixedCode === undefined || !language) {
      res.status(400).json({ message: "Missing questionId, fixedCode, or language." });
      return;
    }

    const userId = req.user!.id;
    let submission = DebugSubmissions.findOne({ userId, roundId: 3 });

    const newEntry = {
      fixedCode,
      language,
      lastSaved: new Date().toISOString(),
      isSubmitted: false,
      pointsEarned: 0,
    };

    if (!submission) {
      submission = DebugSubmissions.create({
        userId,
        roundId: 3,
        answerData: { [questionId]: newEntry },
        submittedAt: null,
        status: "in_progress",
      });
    } else {
      if (submission.status === "submitted") {
        res.status(403).json({ message: "Round 3 already submitted." });
        return;
      }
      const updatedAnswerData = {
        ...submission.answerData,
        [questionId]: {
          ...submission.answerData[questionId],
          ...newEntry,
        },
      };
      DebugSubmissions.update(submission.id, { answerData: updatedAnswerData });
    }

    res.json({ message: "Code saved.", savedAt: newEntry.lastSaved });
  } catch (error) {
    res.status(500).json({ message: "Server error saving code." });
  }
});

// ── POST /api/round3/verify ───────────────────────────────────────────
// Runs participant's fixed code against the question's test cases
// Compares output to the fixedCode's output to determine correctness.
// Uses the question's buggyCode test data for scoring.
router.post("/verify", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { questionId, fixedCode, language } = req.body;

    if (!questionId || fixedCode === undefined || !language) {
      res.status(400).json({ message: "Missing questionId, fixedCode, or language." });
      return;
    }

    const question = QuestionsDebug.findById(questionId);
    if (!question) {
      res.status(404).json({ message: "Question not found." });
      return;
    }

    // Run participant's fixed code and the reference fixed code against a standard test
    // We use a simple approach: run both and compare outputs
    // The admin sets fixedCode which is the ground truth
    const testInput = question.hints.length > 0 ? question.hints[0] : "";

    // Run participant's code
    const participantResults = await executeCode(fixedCode, language, [
      { input: testInput, expectedOutput: "___" }, // placeholder; we compare custom
    ]);

    // Run reference fixed code
    const referenceResults = await executeCode(question.fixedCode, question.language, [
      { input: testInput, expectedOutput: "___" },
    ]);

    const participantOutput = participantResults[0]?.actualOutput?.trim() || "";
    const referenceOutput = referenceResults[0]?.actualOutput?.trim() || "";

    const isCorrect = participantOutput === referenceOutput && !participantResults[0]?.error;

    res.json({
      isCorrect,
      participantOutput,
      referenceOutput,
      error: participantResults[0]?.error || null,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error verifying code.", error: error.message });
  }
});

// ── POST /api/round3/submit ───────────────────────────────────────────
// Final submission — auto-scores each question
router.post("/submit", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const comp = Competition.get();

    if (comp.currentRound < 3 || comp.roundStatus === "closed") {
      res.status(403).json({ message: "Round 3 is not open for submission." });
      return;
    }

    let submission = DebugSubmissions.findOne({ userId, roundId: 3 });

    if (submission?.status === "submitted") {
      res.status(409).json({ message: "Round 3 already submitted." });
      return;
    }

    if (!submission) {
      submission = DebugSubmissions.create({
        userId,
        roundId: 3,
        answerData: {},
        submittedAt: new Date().toISOString(),
        status: "submitted",
      });
      const user = Users.findById(userId);
      if (user) {
        const currentPerms = user.roundPermissions || {};
        Users.update(userId, {
          roundPermissions: { ...currentPerms, 3: "completed" },
        });
      }
      res.json({ message: "Round 3 submitted successfully.", totalPoints: 0 });
      return;
    }

    // Score each question
    const allQuestions = QuestionsDebug.findAll();
    let totalPoints = 0;
    const scoredAnswers = { ...submission.answerData };

    for (const [questionId, answer] of Object.entries(submission.answerData)) {
      const question = allQuestions.find((q) => q.id === questionId);
      if (!question || answer.isSubmitted) continue;

      try {
        const testInput = question.hints.length > 0 ? question.hints[0] : "";
        const [participantResult] = await executeCode(answer.fixedCode, answer.language, [
          { input: testInput, expectedOutput: "___" },
        ]);
        const [referenceResult] = await executeCode(question.fixedCode, question.language, [
          { input: testInput, expectedOutput: "___" },
        ]);

        const participantOut = participantResult?.actualOutput?.trim() || "";
        const referenceOut = referenceResult?.actualOutput?.trim() || "";
        const isCorrect = participantOut === referenceOut && !participantResult?.error;

        const pointsEarned = isCorrect ? question.points : 0;
        totalPoints += pointsEarned;

        scoredAnswers[questionId] = {
          ...answer,
          isSubmitted: true,
          pointsEarned,
        };
      } catch {
        scoredAnswers[questionId] = { ...answer, isSubmitted: true, pointsEarned: 0 };
      }
    }

    DebugSubmissions.update(submission.id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      answerData: scoredAnswers,
    });

    // Lock round 3 as completed for this participant
    const user = Users.findById(userId);
    if (user) {
      const currentPerms = user.roundPermissions || {};
      Users.update(userId, {
        roundPermissions: { ...currentPerms, 3: "completed" },
      });
    }

    ActivityLog.add(userId, "ROUND3_SUBMIT", {
      questionCount: Object.keys(scoredAnswers).length,
      totalPoints,
    });

    res.json({ message: "Round 3 submitted successfully.", totalPoints });
  } catch (error) {
    res.status(500).json({ message: "Server error submitting Round 3." });
  }
});

// ── GET /api/round3/status ────────────────────────────────────────────
router.get("/status", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const submission = DebugSubmissions.findOne({ userId: req.user!.id, roundId: 3 });
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

// ── POST /api/round3/tab-switch ──────────────────────────────────────
router.post("/tab-switch", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    let submission = DebugSubmissions.findOne({ userId, roundId: 3 });

    if (!submission) {
      submission = DebugSubmissions.create({
        userId,
        roundId: 3,
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
    DebugSubmissions.update(submission.id, { tabSwitchCount: newCount });

    ActivityLog.add(userId, "TAB_SWITCH", {
      round: 3,
      totalSwitches: newCount,
    });

    let disqualified = false;
    if (newCount >= 2) {
      disqualified = true;
      DebugSubmissions.update(submission.id, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
      const user = Users.findById(userId);
      if (user) {
        const currentPerms = user.roundPermissions || {};
        Users.update(userId, {
          roundPermissions: { ...currentPerms, 3: "disqualified" },
          currentSessionToken: null,
          qualificationStatus: "eliminated",
        });
      }
      ActivityLog.add(userId, "DISQUALIFIED", { round: 3, reason: "Excessive tab switching" });
    }

    res.json({ success: true, tabSwitchCount: newCount, disqualified });
  } catch (error) {
    res.status(500).json({ message: "Server error logging event." });
  }
});

export default router;
