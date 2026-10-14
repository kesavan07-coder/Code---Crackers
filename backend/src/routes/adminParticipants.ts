import { Router, Response } from "express";
import { authenticateToken, requireAdmin, AuthRequest } from "../middleware/auth";
import { Users, Submissions, CodeSubmissions, DebugSubmissions, QuestionsMCQ, QuestionsCoding, QuestionsDebug, ActivityLog, Competition, db } from "../config/database";

const router = Router();

// ── GET /api/admin/participants ──────────────────────────────────────
router.get("/", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const allUsers = Users.findAll().filter((u) => u.role === "participant");
    const allQuestions = QuestionsMCQ.findAll();
    const totalMCQ = allQuestions.length;

    const results = allUsers.map((user) => {
      const submission1 = Submissions.findOne({ userId: user.id, roundId: 1 });
      const submission2 = CodeSubmissions.findOne({ userId: user.id, roundId: 2 });
      const submission3 = DebugSubmissions.findOne({ userId: user.id, roundId: 3 });

      let r1Score = 0;
      let answeredCount = 0;
      let tabSwitches = 0;

      if (submission1) {
        tabSwitches = submission1.tabSwitchCount || 0;
        Object.entries(submission1.answerData).forEach(([qId, data]) => {
          if (data.answer !== null) answeredCount++;
          const question = allQuestions.find((q) => q.id === qId);
          if (question && data.answer === question.correctAnswer) {
            r1Score++;
          }
        });
      }

      if (user.scoreOverrides && user.scoreOverrides[1] !== undefined) {
        r1Score = user.scoreOverrides[1];
      }

      let r2Score = 0;
      if (submission2) {
        r2Score = Object.keys(submission2.answerData).length * 10;
      }
      if (user.scoreOverrides && user.scoreOverrides[2] !== undefined) {
        r2Score = user.scoreOverrides[2];
      }

      let r3Score = 0;
      if (submission3) {
        r3Score = Object.values(submission3.answerData).reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
      }
      if (user.scoreOverrides && user.scoreOverrides[3] !== undefined) {
        r3Score = user.scoreOverrides[3];
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email || null,
        department: user.department || null,
        fullName: user.fullName || "",
        college: user.college || "",
        isActive: user.isActive,
        isApproved: user.isApproved,
        isLocked: user.isLocked,
        loginEnabled: user.loginEnabled,
        qualificationStatus: user.qualificationStatus || "waiting",
        roundPermissions: user.roundPermissions || { 1: "locked", 2: "locked", 3: "locked" },
        timerExtensionSeconds: user.timerExtensionSeconds || 0,
        scoreOverrides: user.scoreOverrides || {},
        isOnline: user.currentSessionToken !== null,
        round1: {
          status: submission1 ? submission1.status : "not_started",
          score: r1Score,
          answered: answeredCount,
          total: totalMCQ,
          tabSwitches,
          submittedAt: submission1?.submittedAt || null,
        },
        round2: {
          status: submission2 ? submission2.status : "not_started",
          score: r2Score,
          submittedAt: submission2?.submittedAt || null,
        },
        round3: {
          status: submission3 ? submission3.status : "not_started",
          score: r3Score,
          submittedAt: submission3?.submittedAt || null,
        },
      };
    });

    // Sort by score desc, then name asc
    results.sort((a, b) => {
      const scoreA = a.round1.score + a.round2.score + a.round3.score;
      const scoreB = b.round1.score + b.round2.score + b.round3.score;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.username.localeCompare(b.username);
    });

    res.json({ participants: results, totalParticipants: results.length });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching participants." });
  }
});

// ── GET /api/admin/participants/logs ────────────────────────────────
router.get("/logs", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const allLogs = db.get("activityLog").value() || [];
    const allUsers = Users.findAll();
    const formattedLogs = allLogs.map((log: any) => {
      const user = allUsers.find((u) => u.id === log.userId);
      return {
        id: log.id,
        timestamp: log.timestamp,
        username: user ? user.username : "System/Admin",
        action: log.action,
        metadata: log.metadata || {},
      };
    });
    formattedLogs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(formattedLogs);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching logs." });
  }
});

// ── POST /api/admin/participants/create ─────────────────────────────
router.post("/create", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, fullName, email, department, college } = req.body;
    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required." });
      return;
    }
    if (Users.findOne({ username })) {
      res.status(400).json({ message: "Username already exists." });
      return;
    }
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = Users.create({
      username,
      passwordHash,
      role: "participant",
      fullName: fullName || "",
      email: email || "",
      department: department || "",
      college: college || "",
      isActive: true,
      currentSessionToken: null,
      displayPassword: password,  // store for credentials printing
    });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_CREATE", { username });
    res.status(201).json({ message: "Participant created.", user: { id: newUser.id, username: newUser.username } });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/bulk-create ────────────────────────
router.post("/bulk-create", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participants } = req.body;
    if (!Array.isArray(participants)) {
      res.status(400).json({ message: "Payload must be an array." });
      return;
    }
    const bcrypt = require("bcryptjs");
    let count = 0;
    for (const p of participants) {
      if (!p.username || !p.password) continue;
      if (Users.findOne({ username: p.username })) continue;
      const passwordHash = await bcrypt.hash(p.password, 10);
      Users.create({
        username: p.username,
        passwordHash,
        role: "participant",
        fullName: p.fullName || "",
        email: p.email || "",
        department: p.department || "",
        college: p.college || "",
        isActive: true,
        currentSessionToken: null,
        displayPassword: p.password,  // store for credentials printing
      });
      count++;
    }
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_BULK_CREATE", { count });
    res.json({ message: `Successfully imported ${count} participants.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/generate ───────────────────────────
router.post("/generate", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { count = 10, prefix = "CC", department = "", college = "" } = req.body;
    const bcrypt = require("bcryptjs");
    const generated = [];
    const existingUsers = Users.findAll().filter(u => u.username.startsWith(prefix));
    
    let startIndex = 1;
    if (existingUsers.length > 0) {
      const suffixes = existingUsers.map(u => parseInt(u.username.slice(prefix.length)) || 0);
      startIndex = Math.max(...suffixes) + 1;
    }

    for (let i = 0; i < count; i++) {
      const indexStr = (startIndex + i).toString().padStart(3, "0");
      const username = `${prefix}${indexStr}`;
      const password = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(password, 10);

      Users.create({
        username,
        passwordHash,
        role: "participant",
        fullName: `Participant ${indexStr}`,
        email: "",
        department,
        college,
        isActive: true,
        currentSessionToken: null,
        displayPassword: password,  // store for credentials printing
      });

      generated.push({ username, password });
    }
    if (req.user) ActivityLog.add(req.user.id, "CREDENTIALS_GENERATE", { count });
    res.json({ message: `Successfully generated ${count} credentials.`, credentials: generated });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/reset-password ───────────────────
router.post("/:id/reset-password", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    Users.update(id, { passwordHash, displayPassword: password });
    if (req.user) ActivityLog.add(req.user.id, "PASSWORD_RESET", { targetUser: user.username });
    res.json({ message: `Password reset successfully for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/toggle-lock ─────────────────────
router.post("/:id/toggle-lock", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.update(id, { isLocked: !!isLocked, currentSessionToken: null });
    if (req.user) ActivityLog.add(req.user.id, isLocked ? "ACCOUNT_LOCK" : "ACCOUNT_UNLOCK", { targetUser: user.username });
    res.json({ message: `Account ${isLocked ? 'locked' : 'unlocked'}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/toggle-login ────────────────────
router.post("/:id/toggle-login", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { loginEnabled } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.update(id, { loginEnabled: !!loginEnabled, currentSessionToken: null });
    if (req.user) ActivityLog.add(req.user.id, loginEnabled ? "LOGIN_ENABLE" : "LOGIN_DISABLE", { targetUser: user.username });
    res.json({ message: `Login ${loginEnabled ? 'enabled' : 'disabled'} for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/participants/:id/history ──────────────────────────
router.get("/:id/history", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const logs = ActivityLog.getByUser(id) || [];
    
    const r1 = Submissions.findOne({ userId: id, roundId: 1 });
    const r2 = CodeSubmissions.findOne({ userId: id, roundId: 2 });
    const r3 = DebugSubmissions.findOne({ userId: id, roundId: 3 });
    
    res.json({
      profile: {
        id: user.id,
        username: user.username,
        fullName: user.fullName || "",
        email: user.email || "",
        department: user.department || "",
        college: user.college || "",
        isApproved: user.isApproved,
        isLocked: user.isLocked,
        loginEnabled: user.loginEnabled,
        qualificationStatus: user.qualificationStatus || "waiting",
        timerExtensionSeconds: user.timerExtensionSeconds || 0,
      },
      logs,
      submissions: {
        round1: r1 ? { status: r1.status, answers: r1.answerData, submittedAt: r1.submittedAt } : null,
        round2: r2 ? { status: r2.status, answers: r2.answerData, submittedAt: r2.submittedAt } : null,
        round3: r3 ? { status: r3.status, answers: r3.answerData, submittedAt: r3.submittedAt } : null,
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/participants/:id/submission/round1 ─────────────────
router.get("/:id/submission/round1", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const submission = Submissions.findOne({ userId: id, roundId: 1 });
    if (!submission) {
      res.status(404).json({ message: "Submission not found for this participant." });
      return;
    }

    const comp = Competition.get();
    const questions = QuestionsMCQ.findAll();

    let totalScore = 0;
    const questionDetails = questions.map((q) => {
      const studentAns = submission.answerData?.[q.id]?.answer ?? null;
      const isCorrect = studentAns !== null && studentAns === q.correctAnswer;
      const marks = isCorrect ? 1 : 0;
      if (isCorrect) {
        totalScore += 1;
      }
      return {
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        studentAnswer: studentAns,
        marksAwarded: marks,
      };
    });

    if (user.scoreOverrides && user.scoreOverrides[1] !== undefined) {
      totalScore = user.scoreOverrides[1];
    }

    // Time Taken Calculation
    let timeTakenStr = "N/A";
    if (submission.submittedAt && comp.startedAt) {
      const start = new Date(comp.startedAt).getTime();
      const end = new Date(submission.submittedAt).getTime();
      const diffMs = Math.max(0, end - start);
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      timeTakenStr = `${diffMins}m ${diffSecs}s`;
    }

    res.json({
      fullName: user.fullName || "N/A",
      username: user.username,
      department: user.department || "CSBS",
      roundName: "Round 1 - MCQ",
      submissionTime: submission.submittedAt,
      timeTaken: timeTakenStr,
      totalScore,
      questions: questionDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching submission details." });
  }
});

// ── GET /api/admin/participants/credentials/export ───────────────────
router.get("/credentials/export", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const participants = Users.findAll().filter((u) => u.role === "participant");
    const credentials = participants.map((u) => ({
      username: u.username,
      password: u.displayPassword || "(not stored)",
      fullName: u.fullName || "",
      department: u.department || "",
      college: u.college || "",
    }));
    res.json({ credentials, total: credentials.length, exportedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: "Server error exporting credentials." });
  }
});

// ── GET /api/admin/participants/:id/submission/round2 ─────────────────
router.get("/:id/submission/round2", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) { res.status(404).json({ message: "User not found." }); return; }

    const submission = CodeSubmissions.findOne({ userId: id, roundId: 2 });
    if (!submission) { res.status(404).json({ message: "No Round 2 submission found." }); return; }

    const allQuestions = QuestionsCoding.findAll();
    const comp = Competition.get();

    let r2Score = 0;
    const questionDetails = allQuestions.map((q) => {
      const answer = submission.answerData?.[q.id];
      if (answer) r2Score += 10;
      return {
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        points: 10,
        submittedCode: answer?.code || "",
        language: answer?.language || "N/A",
        isSubmitted: answer?.isSubmitted || false,
        lastSaved: answer?.lastSaved || null,
      };
    });

    if (user.scoreOverrides?.[2] !== undefined) r2Score = user.scoreOverrides[2];

    let timeTakenStr = "N/A";
    if (submission.submittedAt && comp.startedAt) {
      const diffMs = Math.max(0, new Date(submission.submittedAt).getTime() - new Date(comp.startedAt).getTime());
      timeTakenStr = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
    }

    res.json({
      fullName: user.fullName || "N/A",
      username: user.username,
      department: user.department || "CSBS",
      roundName: "Round 2 - Coding",
      submissionTime: submission.submittedAt,
      timeTaken: timeTakenStr,
      totalScore: r2Score,
      questions: questionDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching Round 2 submission." });
  }
});

// ── GET /api/admin/participants/:id/submission/round3 ─────────────────
router.get("/:id/submission/round3", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) { res.status(404).json({ message: "User not found." }); return; }

    const submission = DebugSubmissions.findOne({ userId: id, roundId: 3 });
    if (!submission) { res.status(404).json({ message: "No Round 3 submission found." }); return; }

    const allQuestions = QuestionsDebug.findAll();
    const comp = Competition.get();

    let r3Score = 0;
    const questionDetails = allQuestions.map((q) => {
      const answer = submission.answerData?.[q.id];
      const pointsEarned = answer?.pointsEarned || 0;
      r3Score += pointsEarned;
      return {
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        points: q.points,
        pointsEarned,
        submittedCode: answer?.fixedCode || "",
        language: answer?.language || q.language,
        isCorrect: pointsEarned > 0,
        lastSaved: answer?.lastSaved || null,
      };
    });

    if (user.scoreOverrides?.[3] !== undefined) r3Score = user.scoreOverrides[3];

    let timeTakenStr = "N/A";
    if (submission.submittedAt && comp.startedAt) {
      const diffMs = Math.max(0, new Date(submission.submittedAt).getTime() - new Date(comp.startedAt).getTime());
      timeTakenStr = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
    }

    res.json({
      fullName: user.fullName || "N/A",
      username: user.username,
      department: user.department || "CSBS",
      roundName: "Round 3 - Bug Hunter",
      submissionTime: submission.submittedAt,
      timeTaken: timeTakenStr,
      totalScore: r3Score,
      questions: questionDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching Round 3 submission." });
  }
});

// ── GET /api/admin/participants/reports/data ─────────────────────────
router.get("/reports/data", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const allUsers = Users.findAll().filter((u) => u.role === "participant");
    const allQuestions = QuestionsMCQ.findAll();

    const compObj = Competition.get();
    const logs = db.get("activityLog").value() || [];
    let r1Start: string | null = compObj.roundStartedAt?.[1] || null;
    let r2Start: string | null = compObj.roundStartedAt?.[2] || null;
    let r3Start: string | null = compObj.roundStartedAt?.[3] || null;

    // Fallback to activity log if Competition settings missing timestamp
    logs.forEach((log: any) => {
      if (log.action === "COMPETITION_START" && !r1Start) {
        r1Start = log.timestamp;
      }
      if (log.action === "ROUND_OPEN" || log.action === "ROUND_START") {
        const r = Number(log.metadata?.round);
        if (r === 1 && !r1Start) r1Start = log.timestamp;
        if (r === 2 && !r2Start) r2Start = log.timestamp;
        if (r === 3 && !r3Start) r3Start = log.timestamp;
      }
    });

    const getDurationStr = (startIso: string | null, endIso: string | null) => {
      if (!startIso || !endIso) return "N/A";
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      const diffMs = Math.max(0, end - start);
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      if (diffMins === 0) return `${diffSecs} secs`;
      return `${diffMins} mins ${diffSecs} secs`;
    };

    const results = allUsers.map((user) => {
      const submission1 = Submissions.findOne({ userId: user.id, roundId: 1 });
      const submission2 = CodeSubmissions.findOne({ userId: user.id, roundId: 2 });
      const submission3 = DebugSubmissions.findOne({ userId: user.id, roundId: 3 });

      let r1Score = 0;
      if (submission1) {
        Object.entries(submission1.answerData).forEach(([qId, data]) => {
          const question = allQuestions.find((q) => q.id === qId);
          if (question && data.answer === question.correctAnswer) {
            r1Score++;
          }
        });
      }
      if (user.scoreOverrides && user.scoreOverrides[1] !== undefined) {
        r1Score = user.scoreOverrides[1];
      }

      let r2Score = 0;
      if (submission2) {
        r2Score = Object.keys(submission2.answerData).length * 10;
      }
      if (user.scoreOverrides && user.scoreOverrides[2] !== undefined) {
        r2Score = user.scoreOverrides[2];
      }

      let r3Score = 0;
      if (submission3) {
        r3Score = Object.values(submission3.answerData).reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
      }
      if (user.scoreOverrides && user.scoreOverrides[3] !== undefined) {
        r3Score = user.scoreOverrides[3];
      }

      const totalScore = r1Score + r2Score + r3Score;

      const formatTime = (isoStr: string | null) => {
        if (!isoStr) return "N/A";
        return new Date(isoStr).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
      };

      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName || "N/A",
        year: user.year || "N/A",
        department: user.department || "CSBS",
        college: user.college || "N/A",
        createdAt: user.createdAt || "",
        qualificationStatus: user.qualificationStatus || "waiting",
        round1: {
          score: r1Score,
          submissionTime: formatTime(submission1?.submittedAt || null),
          status: submission1 ? submission1.status : "not_started",
          timeTaken: getDurationStr(r1Start, submission1?.submittedAt || null),
        },
        round2: {
          score: r2Score,
          submissionTime: formatTime(submission2?.submittedAt || null),
          status: submission2 ? submission2.status : "not_started",
          timeTaken: getDurationStr(r2Start, submission2?.submittedAt || null),
        },
        round3: {
          score: r3Score,
          submissionTime: formatTime(submission3?.submittedAt || null),
          status: submission3 ? submission3.status : "not_started",
          timeTaken: getDurationStr(r3Start, submission3?.submittedAt || null),
        },
        totalScore,
      };
    });

    // Sort by totalScore desc
    results.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks
    const rankedResults = results.map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

    res.json(rankedResults);
  } catch (error) {
    res.status(500).json({ message: "Server error preparing report data." });
  }
});

// ── POST /api/admin/participants/bulk-action ─────────────────────────
router.post("/bulk-action", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: "No participant IDs provided." });
      return;
    }

    const bcrypt = require("bcryptjs");
    let successCount = 0;

    for (const id of ids) {
      const user = Users.findById(id);
      if (!user || user.role === "admin") continue;

      if (action === "delete") {
        Users.remove(id);
        if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_DELETE", { username: user.username });
        successCount++;
      } else if (action === "lock") {
        Users.update(id, { isLocked: true, currentSessionToken: null });
        if (req.user) ActivityLog.add(req.user.id, "ACCOUNT_LOCK", { targetUser: user.username });
        successCount++;
      } else if (action === "unlock") {
        Users.update(id, { isLocked: false });
        if (req.user) ActivityLog.add(req.user.id, "ACCOUNT_UNLOCK", { targetUser: user.username });
        successCount++;
      } else if (action === "reset-password") {
        const password = value || "pass123";
        const passwordHash = await bcrypt.hash(password, 10);
        Users.update(id, { passwordHash, displayPassword: password });
        if (req.user) ActivityLog.add(req.user.id, "PASSWORD_RESET", { targetUser: user.username });
        successCount++;
      }
    }

    res.json({ message: `Successfully performed bulk action: ${action} on ${successCount} participants.` });
  } catch (error) {
    res.status(500).json({ message: "Server error performing bulk action." });
  }
});

// ── POST /api/admin/participants/approve-all ─────────────────────────
router.post("/approve-all", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const unapproved = Users.findAll().filter((u) => u.role === "participant" && !u.isApproved);
    let count = 0;
    for (const user of unapproved) {
      Users.update(user.id, { isApproved: true });
      count++;
    }
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_APPROVE_ALL", { count });
    res.json({ message: "All waiting participants have been approved successfully.", approvedCount: count });
  } catch (error) {
    res.status(500).json({ message: "Server error approving all participants." });
  }
});

// ── POST /api/admin/participants/:id/approve ─────────────────────────
router.post("/:id/approve", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.update(id, { isApproved: true });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_APPROVE", { targetUser: user.username });
    res.json({ message: `${user.username} approved to join.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/reject ──────────────────────────
router.post("/:id/reject", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.update(id, { isApproved: false, currentSessionToken: null });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_REJECT", { targetUser: user.username });
    res.json({ message: `${user.username} removed from waiting lounge.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/late-join ───────────────────────
router.post("/:id/late-join", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { round = 1 } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const currentPerms = user.roundPermissions || {};
    Users.update(id, {
      isApproved: true,
      roundPermissions: {
        ...currentPerms,
        [round]: "open",
      }
    });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_LATE_JOIN", { targetUser: user.username, round });
    res.json({ message: `Participant allowed to join Round ${round}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/qualification ───────────────────
router.post("/:id/qualification", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.update(id, { qualificationStatus: status });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_QUALIFICATION", { targetUser: user.username, status });
    res.json({ message: `Qualification set to ${status} for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/override-round ──────────────────
router.post("/:id/override-round", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { round, status } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const currentPerms = user.roundPermissions || { 1: "locked", 2: "locked", 3: "locked" };
    const updatedPerms = { ...currentPerms, [round]: status };
    Users.update(id, { roundPermissions: updatedPerms });

    if (status === "open" || status === "locked") {
      if (Number(round) === 1) {
        const sub = Submissions.findOne({ userId: id, roundId: 1 });
        if (sub) Submissions.update(sub.id, { status: status === "open" ? "in_progress" : "submitted" });
      } else if (Number(round) === 2) {
        const sub = CodeSubmissions.findOne({ userId: id, roundId: 2 });
        if (sub) CodeSubmissions.update(sub.id, { status: status === "open" ? "in_progress" : "submitted" });
      } else if (Number(round) === 3) {
        const sub = DebugSubmissions.findOne({ userId: id, roundId: 3 });
        if (sub) DebugSubmissions.update(sub.id, { status: status === "open" ? "in_progress" : "submitted" });
      }
    }

    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_ROUND_OVERRIDE", { targetUser: user.username, round, status });
    res.json({ message: `Round ${round} state overridden to ${status} for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/extend-timer ────────────────────
router.post("/:id/extend-timer", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { seconds } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const currentExt = user.timerExtensionSeconds || 0;
    Users.update(id, { timerExtensionSeconds: currentExt + Number(seconds) });
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_TIMER_EXTEND", { targetUser: user.username, seconds });
    res.json({ message: `Timer extended by ${seconds} seconds for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/force-submit ────────────────────
router.post("/:id/force-submit", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { round } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    if (Number(round) === 1) {
      const sub = Submissions.findOne({ userId: id, roundId: 1 });
      if (sub) Submissions.update(sub.id, { status: "submitted", submittedAt: new Date().toISOString() });
    } else if (Number(round) === 2) {
      const sub = CodeSubmissions.findOne({ userId: id, roundId: 2 });
      if (sub) CodeSubmissions.update(sub.id, { status: "submitted", submittedAt: new Date().toISOString() });
    } else if (Number(round) === 3) {
      const sub = DebugSubmissions.findOne({ userId: id, roundId: 3 });
      if (sub) DebugSubmissions.update(sub.id, { status: "submitted", submittedAt: new Date().toISOString() });
    }

    const currentPerms = user.roundPermissions || {};
    Users.update(id, { roundPermissions: { ...currentPerms, [round]: "completed" } });

    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_FORCE_SUBMIT", { targetUser: user.username, round });
    res.json({ message: `Force submitted Round ${round} for ${user.username}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/:id/edit-score ──────────────────────
router.post("/:id/edit-score", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { round, score } = req.body;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const currentOverrides = user.scoreOverrides || {};
    Users.update(id, {
      scoreOverrides: {
        ...currentOverrides,
        [round]: Number(score),
      }
    });
    if (req.user) ActivityLog.add(req.user.id, "SCORE_OVERRIDE", { targetUser: user.username, round, score });
    res.json({ message: `Score overridden to ${score} for Round ${round}.` });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── DELETE /api/admin/participants/:id ───────────────────────────────
router.delete("/:id", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const user = Users.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    Users.remove(id);
    if (req.user) ActivityLog.add(req.user.id, "PARTICIPANT_DELETE", { username: user.username });
    res.json({ message: "Participant account permanently deleted." });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/participants/reset-submissions ────────────────────
router.post("/reset-submissions", authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  try {
    db.set("submissions", []).write();
    db.set("codeSubmissions", []).write();
    db.set("debugSubmissions", []).write();
    if (req.user) ActivityLog.add(req.user.id, "RESET_ALL_SUBMISSIONS", {});
    res.json({ message: "All participant submissions successfully cleared." });
  } catch (error) {
    res.status(500).json({ message: "Server error resetting submissions." });
  }
});

export default router;
