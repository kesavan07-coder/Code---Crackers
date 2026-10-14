import { Router, Response } from "express";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";
import { QuestionsMCQ } from "../config/database";

const router = Router();

// ── GET /api/admin/questions/mcq ─────────────────────────────────────
router.get("/mcq", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { roundId } = req.query;
    let list = QuestionsMCQ.findAll();
    if (roundId) {
      const rId = String(roundId);
      list = list.filter((q) => q.roundId === rId || (!q.roundId && (rId === "built_in_1" || rId === "1")));
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Server error listing questions." });
  }
});

// ── POST /api/admin/questions/mcq ────────────────────────────────────
router.post("/mcq", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { questionText, options, correctAnswer, difficulty, order, roundId } = req.body;

    if (!questionText || !options || options.length !== 4 || correctAnswer === undefined) {
      res.status(400).json({ message: "Invalid question details. Must contain text, 4 options, and correctAnswer index." });
      return;
    }

    const nextOrder = order !== undefined ? order : QuestionsMCQ.count() + 1;

    const newQuestion = QuestionsMCQ.create({
      roundId: roundId ? String(roundId) : "built_in_1",
      questionText,
      options,
      correctAnswer: Number(correctAnswer),
      difficulty: difficulty || "medium",
      order: Number(nextOrder),
    });

    res.status(201).json({ message: "Question created successfully.", question: newQuestion });
  } catch (error) {
    res.status(500).json({ message: "Server error creating question." });
  }
});

// ── PUT /api/admin/questions/mcq/:id ──────────────────────────────────
router.put("/mcq/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const patch = req.body;

    const exists = QuestionsMCQ.findById(id);
    if (!exists) {
      res.status(404).json({ message: "Question not found." });
      return;
    }

    const updated = QuestionsMCQ.update(id, patch);
    res.json({ message: "Question updated successfully.", question: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error updating question." });
  }
});

// ── DELETE /api/admin/questions/mcq/:id ───────────────────────────────
router.delete("/mcq/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;

    const exists = QuestionsMCQ.findById(id);
    if (!exists) {
      res.status(404).json({ message: "Question not found." });
      return;
    }

    QuestionsMCQ.remove(id);
    res.json({ message: "Question deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error deleting question." });
  }
});

// ── POST /api/admin/questions/mcq/bulk-import ─────────────────────────
router.post("/mcq/bulk-import", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { questions, roundId } = req.body; // Expect an array of objects matching QuestionMCQRecord (without id)

    if (!Array.isArray(questions)) {
      res.status(400).json({ message: "Invalid payload. Questions must be an array." });
      return;
    }

    let addedCount = 0;
    questions.forEach((q) => {
      if (q.questionText && q.options && q.options.length === 4 && q.correctAnswer !== undefined) {
        QuestionsMCQ.create({
          roundId: q.roundId ? String(q.roundId) : roundId ? String(roundId) : "built_in_1",
          questionText: q.questionText,
          options: q.options,
          correctAnswer: Number(q.correctAnswer),
          difficulty: q.difficulty || "medium",
          order: q.order !== undefined ? Number(q.order) : QuestionsMCQ.count() + 1,
        });
        addedCount++;
      }
    });

    res.json({ message: `Successfully imported ${addedCount} questions.` });
  } catch (error) {
    res.status(500).json({ message: "Server error importing questions." });
  }
});

export default router;
