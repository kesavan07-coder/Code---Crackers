import { Router, Response } from "express";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";
import { QuestionsDebug, DebugSubmissions, Users } from "../config/database";

const router = Router();

// ── GET /api/admin/questions/debug ───────────────────────────────────
router.get("/debug", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { roundId } = req.query;
    let list = QuestionsDebug.findAll();
    if (roundId) {
      const rId = String(roundId);
      list = list.filter((q) => q.roundId === rId || (!q.roundId && (rId === "built_in_3" || rId === "3")));
    }
    res.json(list);
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/questions/debug ──────────────────────────────────
router.post("/debug", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { title, description, buggyCode, fixedCode, language, hints, points, difficulty, order, roundId } = req.body;
    if (!title || !buggyCode || !fixedCode) {
      res.status(400).json({ message: "Title, buggyCode, and fixedCode are required." });
      return;
    }
    const q = QuestionsDebug.create({
      roundId: roundId ? String(roundId) : "built_in_3",
      title,
      description: description || "",
      buggyCode,
      fixedCode,
      language: language || "javascript",
      hints: hints || [],
      points: points ?? 10,
      difficulty: difficulty || "medium",
      order: order ?? QuestionsDebug.count() + 1,
    });
    res.status(201).json({ message: "Debug question created.", question: q });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── PUT /api/admin/questions/debug/:id ───────────────────────────────
router.put("/debug/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    if (!QuestionsDebug.findById(id)) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    const updated = QuestionsDebug.update(id, req.body);
    res.json({ message: "Updated.", question: updated });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── DELETE /api/admin/questions/debug/:id ────────────────────────────
router.delete("/debug/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    if (!QuestionsDebug.findById(id)) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    QuestionsDebug.remove(id);
    res.json({ message: "Deleted." });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/questions/debug/bulk-import ───────────────────────
router.post("/debug/bulk-import", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { questions, roundId } = req.body;
    if (!Array.isArray(questions)) {
      res.status(400).json({ message: "Questions must be an array." });
      return;
    }
    let added = 0;
    questions.forEach((q) => {
      if (q.title && q.buggyCode && q.fixedCode) {
        QuestionsDebug.create({
          roundId: q.roundId ? String(q.roundId) : roundId ? String(roundId) : "built_in_3",
          title: q.title,
          description: q.description || "",
          buggyCode: q.buggyCode,
          fixedCode: q.fixedCode,
          language: q.language || "javascript",
          hints: q.hints || [],
          points: q.points ?? 10,
          difficulty: q.difficulty || "medium",
          order: q.order ?? QuestionsDebug.count() + 1,
        });
        added++;
      }
    });
    res.json({ message: `Imported ${added} debug questions.` });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/questions/debug/submissions ────────────────────────
router.get("/debug/submissions", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const allSubs = DebugSubmissions.find({ roundId: 3 });
    const allUsers = Users.findAll();
    const result = allSubs.map((sub) => {
      const user = allUsers.find((u) => u.id === sub.userId);
      const totalPoints = Object.values(sub.answerData).reduce(
        (sum, a) => sum + (a.pointsEarned || 0),
        0
      );
      return {
        userId: sub.userId,
        username: user?.username || "Unknown",
        department: user?.department || null,
        status: sub.status,
        submittedAt: sub.submittedAt,
        questionsAttempted: Object.keys(sub.answerData).length,
        totalPoints,
      };
    });
    res.json(result);
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
