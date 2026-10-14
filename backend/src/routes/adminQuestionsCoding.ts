import { Router, Response } from "express";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";
import { QuestionsCoding, CodeSubmissions, Users } from "../config/database";

const router = Router();

// ── GET /api/admin/questions/coding ──────────────────────────────────
router.get("/coding", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { roundId } = req.query;
    let list = QuestionsCoding.findAll();
    if (roundId) {
      const rId = String(roundId);
      list = list.filter((q) => q.roundId === rId || (!q.roundId && (rId === "built_in_2" || rId === "2")));
    }
    res.json(list);
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/questions/coding ─────────────────────────────────
router.post("/coding", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { title, story, examples, constraints, visibleTestCases, difficulty, order, timeLimit, memoryLimit, roundId } = req.body;
    if (!title || !story) {
      res.status(400).json({ message: "Title and story are required." });
      return;
    }
    const q = QuestionsCoding.create({
      roundId: roundId ? String(roundId) : "built_in_2",
      title,
      story,
      examples: examples || [],
      constraints: constraints || "",
      visibleTestCases: visibleTestCases || [],
      difficulty: difficulty || "medium",
      order: order ?? QuestionsCoding.count() + 1,
      timeLimit: timeLimit || 2,
      memoryLimit: memoryLimit || 256,
    });
    res.status(201).json({ message: "Coding question created.", question: q });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── PUT /api/admin/questions/coding/:id ──────────────────────────────
router.put("/coding/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    if (!QuestionsCoding.findById(id)) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    const updated = QuestionsCoding.update(id, req.body);
    res.json({ message: "Updated.", question: updated });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── DELETE /api/admin/questions/coding/:id ────────────────────────────
router.delete("/coding/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    if (!QuestionsCoding.findById(id)) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    QuestionsCoding.remove(id);
    res.json({ message: "Deleted." });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/questions/coding/bulk-import ─────────────────────
router.post("/coding/bulk-import", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { questions, roundId } = req.body;
    if (!Array.isArray(questions)) {
      res.status(400).json({ message: "Questions must be an array." });
      return;
    }
    let added = 0;
    questions.forEach((q) => {
      if (q.title && q.story) {
        QuestionsCoding.create({
          roundId: q.roundId ? String(q.roundId) : roundId ? String(roundId) : "built_in_2",
          title: q.title,
          story: q.story,
          examples: q.examples || [],
          constraints: q.constraints || "",
          visibleTestCases: q.visibleTestCases || [],
          difficulty: q.difficulty || "medium",
          order: q.order ?? QuestionsCoding.count() + 1,
          timeLimit: q.timeLimit || 2,
          memoryLimit: q.memoryLimit || 256,
        });
        added++;
      }
    });
    res.json({ message: `Imported ${added} coding questions.` });
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/questions/coding/submissions ───────────────────────
// Admin: see all code submissions for round 2
router.get("/coding/submissions", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const allSubs = CodeSubmissions.find({ roundId: 2 });
    const allUsers = Users.findAll();
    const result = allSubs.map((sub) => {
      const user = allUsers.find((u) => u.id === sub.userId);
      return {
        userId: sub.userId,
        username: user?.username || "Unknown",
        department: user?.department || null,
        status: sub.status,
        submittedAt: sub.submittedAt,
        questionsAttempted: Object.keys(sub.answerData).length,
      };
    });
    res.json(result);
  } catch {
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
