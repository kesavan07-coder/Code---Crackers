import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Users, ActivityLog } from "../config/database";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "code_crackers_secret_key_2026_xyz";

// ── POST /api/auth/login ─────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required." });
    return;
  }

  try {
    const user = Users.findOne({ username });
    if (!user) {
      res.status(401).json({ message: "Invalid username or password." });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: "Account is deactivated. Please contact the admin." });
      return;
    }

    if (user.isLocked) {
      res.status(403).json({ message: "Your account is locked by the admin." });
      return;
    }

    if (user.loginEnabled === false) {
      res.status(403).json({ message: "Your login is disabled by the admin." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid username or password." });
      return;
    }

    // Single session: generate new session token and invalidate previous
    const sessionToken = crypto.randomBytes(32).toString("hex");
    Users.update(user.id, { currentSessionToken: sessionToken });

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, sessionToken },
      JWT_SECRET,
      { expiresIn: "6h" }
    );

    ActivityLog.add(user.id, "LOGIN", {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const needsNameSetup = user.role === "participant" && (!user.fullName || !user.firstLoginCompleted);

    res.json({
      token,
      needsNameSetup,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        department: user.department,
        email: user.email,
        fullName: user.fullName || "",
        year: user.year || "",
        college: user.college || "",
        firstLoginCompleted: !!user.firstLoginCompleted,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────
router.post("/logout", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (req.user) {
      Users.update(req.user.id, { currentSessionToken: null });
      ActivityLog.add(req.user.id, "LOGOUT", {});
    }
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout." });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────
router.get("/me", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    const user = Users.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    const needsNameSetup = user.role === "participant" && (!user.fullName || !user.firstLoginCompleted);
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
      email: user.email,
      fullName: user.fullName || "",
      year: user.year || "",
      college: user.college || "",
      firstLoginCompleted: !!user.firstLoginCompleted,
      needsNameSetup,
    });
  } catch (error) {
    console.error("Fetch /me error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/auth/update-profile ────────────────────────────────────
router.post("/update-profile", authenticateToken, (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }
    const { fullName, year, department, college, collegeName } = req.body;
    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      res.status(400).json({ message: "Full Name is required." });
      return;
    }

    const finalCollege = (college || collegeName || "").trim();
    const finalYear = (year || "").trim();
    const finalDept = (department || "").trim();

    const updated = Users.update(req.user.id, {
      fullName: fullName.trim(),
      ...(finalYear ? { year: finalYear } : {}),
      ...(finalDept ? { department: finalDept } : {}),
      ...(finalCollege ? { college: finalCollege } : {}),
      firstLoginCompleted: true,
    });

    if (!updated) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    ActivityLog.add(req.user.id, "PROFILE_NAME_SETUP", {
      fullName: fullName.trim(),
      year: finalYear,
      department: finalDept,
      college: finalCollege,
    });

    res.json({
      message: "Profile updated successfully.",
      user: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        department: updated.department,
        email: updated.email,
        fullName: updated.fullName,
        year: updated.year,
        college: updated.college,
        firstLoginCompleted: true,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error updating profile." });
  }
});

// Helper to ensure super_admin accounts exist
async function ensureAdminAccount() {
  try {
    const superHash = await bcrypt.hash("SuperAdmin@2026", 10);
    const kesavanHash = await bcrypt.hash("Kesavan@2007", 10);

    let superUser = Users.findOne({ username: "superadmin" });
    if (!superUser) {
      Users.create({
        username: "superadmin",
        passwordHash: superHash,
        role: "super_admin",
        fullName: "Super Administrator",
        department: "CSBS",
        email: "superadmin@codecrackers.com",
        isActive: true,
        currentSessionToken: null,
        isApproved: true,
        permissions: ["*"],
      });
    }

    let kesavanUser = Users.findOne({ username: "Kesavan K" });
    if (!kesavanUser) {
      Users.create({
        username: "Kesavan K",
        passwordHash: kesavanHash,
        role: "super_admin",
        fullName: "Kesavan K",
        department: "CSBS",
        email: "admin@codecrackers.com",
        isActive: true,
        currentSessionToken: null,
        isApproved: true,
        permissions: ["*"],
      });
    } else {
      Users.update(kesavanUser.id, { role: "super_admin", permissions: ["*"] });
    }
  } catch (e) {
    console.error("Failed to ensure admin account:", e);
  }
}
ensureAdminAccount();

// ── POST /api/auth/seed ──────────────────────────────────────────────
// One-time dev helper: creates admin + one participant account + 5 MCQ questions
router.post("/seed", async (req: Request, res: Response): Promise<void> => {
  try {
    const isFirstTime = Users.count() === 0;

    if (isFirstTime) {
      const adminHash = await bcrypt.hash("admin123", 10);
      const participantHash = await bcrypt.hash("pass123", 10);

      Users.create({
        username: "admin",
        passwordHash: adminHash,
        role: "admin",
        department: "CSBS",
        email: "admin@college.edu",
        isActive: true,
        currentSessionToken: null,
        fullName: "System Administrator",
        college: "Main Campus",
        isApproved: true,
      });

      Users.create({
        username: "participant1",
        passwordHash: participantHash,
        role: "participant",
        department: "ECE",
        email: "p1@college.edu",
        isActive: true,
        currentSessionToken: null,
        fullName: "Participant One",
        college: "Engineering College",
        isApproved: true,
      });
    }

    const { QuestionsMCQ } = require("../config/database");
    if (QuestionsMCQ.count() === 0) {
      QuestionsMCQ.create({
        questionText: "What is the time complexity of searching in a balanced Binary Search Tree (BST)?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        correctAnswer: 1, // O(log n)
        difficulty: "easy",
        order: 1,
      });

      QuestionsMCQ.create({
        questionText: "Which data structure operates on a Last In First Out (LIFO) basis?",
        options: ["Queue", "Stack", "Binary Tree", "Heap"],
        correctAnswer: 1, // Stack
        difficulty: "easy",
        order: 2,
      });

      QuestionsMCQ.create({
        questionText: "Which of the following sorting algorithms has a worst-case time complexity of O(n^2)?",
        options: ["Merge Sort", "Quick Sort", "Heap Sort", "Bubble Sort"],
        correctAnswer: 3, // Bubble Sort
        difficulty: "medium",
        order: 3,
      });

      QuestionsMCQ.create({
        questionText: "What is the size of an integer variable (int) in standard Java?",
        options: ["1 byte", "2 bytes", "4 bytes", "8 bytes"],
        correctAnswer: 2, // 4 bytes
        difficulty: "easy",
        order: 4,
      });

      QuestionsMCQ.create({
        questionText: "In JavaScript, what is the type of a variable that has not been assigned a value?",
        options: ["null", "undefined", "NaN", "void"],
        correctAnswer: 1, // undefined
        difficulty: "easy",
        order: 5,
      });
    }

    const { QuestionsCoding } = require("../config/database");
    if (QuestionsCoding.count() === 0) {
      QuestionsCoding.create({
        title: "Even or Odd Sum",
        story: "The tech wizard of Codeville needs a program that reads a list of space-separated integers from standard input, calculates their sum, and outputs 'EVEN' if the sum is even, or 'ODD' if the sum is odd.",
        constraints: "The input contains a single line of space-separated integers. Each integer is between -1000 and 1000.",
        examples: [
          { input: "1 2 3", output: "EVEN", explanation: "1 + 2 + 3 = 6, which is even." },
          { input: "4 5", output: "ODD", explanation: "4 + 5 = 9, which is odd." }
        ],
        visibleTestCases: [
          { input: "1 2 3", expectedOutput: "EVEN" },
          { input: "4 5", expectedOutput: "ODD" },
          { input: "10", expectedOutput: "EVEN" }
        ],
        difficulty: "easy",
        order: 1,
        timeLimit: 2,
        memoryLimit: 256
      });

      QuestionsCoding.create({
        title: "The Cipher's Reverse",
        story: "For encrypted transmissions, you need to reverse each individual word in a sentence while maintaining the original order of the words. Words are separated by a single space.",
        constraints: "Input contains words separated by single spaces. Maximum length of sentence is 1000 characters.",
        examples: [
          { input: "hello world", output: "olleh dlrow", explanation: "Reversing 'hello' gives 'olleh' and 'world' gives 'dlrow'." }
        ],
        visibleTestCases: [
          { input: "hello world", expectedOutput: "olleh dlrow" },
          { input: "code crackers", expectedOutput: "edoc srekcarc" }
        ],
        difficulty: "medium",
        order: 2,
        timeLimit: 2,
        memoryLimit: 256
      });

      QuestionsCoding.create({
        title: "Find the Duplicate Signal",
        story: "You are monitoring sensor data. The signal stream is a list of space-separated integers. There is exactly one number that is duplicated. Find and print the duplicate number.",
        constraints: "Input consists of N space-separated integers. 2 <= N <= 1000.",
        examples: [
          { input: "1 3 2 1", output: "1", explanation: "1 appears twice in the input." }
        ],
        visibleTestCases: [
          { input: "1 3 2 1", expectedOutput: "1" },
          { input: "3 1 2 2", expectedOutput: "2" }
        ],
        difficulty: "medium",
        order: 3,
        timeLimit: 2,
        memoryLimit: 256
      });
    }

    res.json({
      message: "Seeded successfully!",
      credentials: {
        admin: { username: "admin", password: "admin123" },
        participant: { username: "participant1", password: "pass123" },
      },
      questionsSeeded: QuestionsMCQ.count(),
      codingQuestionsSeeded: QuestionsCoding.count()
    });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({ message: "Server error during seeding." });
  }
});

export default router;
