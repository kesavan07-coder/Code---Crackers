import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { Users, ActivityLog } from "../config/database";
import { authenticateToken, requireSuperAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// Available Admin Permissions Matrix
export const ADMIN_PERMISSIONS = [
  { key: "view_participants", label: "View Participants & Results" },
  { key: "manage_participants", label: "Manage Participants (Create, Edit, Delete, Reset)" },
  { key: "start_stop_rounds", label: "Start & Stop Competition Rounds" },
  { key: "manage_questions", label: "Manage Questions (MCQ, Coding, Debug)" },
  { key: "generate_reports", label: "Generate & Export Reports" },
  { key: "publish_leaderboard", label: "Publish & Hide Leaderboards" },
  { key: "manage_security", label: "Manage Anti-Cheat & Security Settings" },
  { key: "portal_settings", label: "Manage Portal Branding & Configuration" },
];

// ── GET /api/admins ───────────────────────────────────────────────────
// Returns list of all Admin and Super Admin accounts
router.get("/", authenticateToken, (req: AuthRequest, res: Response): void => {
  const allUsers = Users.findAll();
  const users = allUsers.filter((u) => u.role === "admin" || u.role === "super_admin");
  const sanitized = users.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName || u.username,
    role: u.role,
    permissions: u.permissions || [],
    email: u.email || "",
    department: u.department || "",
    isApproved: u.isApproved,
    isLocked: u.isLocked,
    loginEnabled: u.loginEnabled,
    createdAt: u.createdAt,
  }));
  res.json({ admins: sanitized, availablePermissions: ADMIN_PERMISSIONS });
});

// ── POST /api/admins ──────────────────────────────────────────────────
// Super Admin creates a new Admin account
router.post("/", authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, password, fullName, email, department, role, permissions } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required." });
    return;
  }

  const existing = Users.findOne({ username });
  if (existing) {
    res.status(400).json({ message: `Username '${username}' is already taken.` });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newAdmin = Users.create({
    username: username.trim(),
    passwordHash,
    role: role === "super_admin" ? "super_admin" : "admin",
    permissions: Array.isArray(permissions) ? permissions : ["view_participants"],
    fullName: fullName || username,
    email: email || "",
    department: department || "CSBS",
    isActive: true,
    isApproved: true,
    isLocked: false,
    loginEnabled: true,
    currentSessionToken: null,
  });

  if (req.user) {
    ActivityLog.add(req.user.id, "ADMIN_CREATED", {
      createdAdminUsername: username,
      role: newAdmin.role,
      permissions: newAdmin.permissions,
    });
  }

  res.status(201).json({
    message: "Admin account created successfully.",
    admin: {
      id: newAdmin.id,
      username: newAdmin.username,
      role: newAdmin.role,
      permissions: newAdmin.permissions,
    },
  });
});

// ── PUT /api/admins/:id ───────────────────────────────────────────────
// Super Admin updates an Admin account's profile, password, or permissions
router.put("/:id", authenticateToken, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = req.params.id;
  const admin = Users.findById(adminId);

  if (!admin) {
    res.status(404).json({ message: "Admin account not found." });
    return;
  }

  const { username, password, fullName, email, department, role, permissions } = req.body;
  const patch: Record<string, any> = {};

  if (username && username !== admin.username) {
    const existing = Users.findOne({ username });
    if (existing && existing.id !== adminId) {
      res.status(400).json({ message: "Username is already taken." });
      return;
    }
    patch.username = username.trim();
  }

  if (password) {
    patch.passwordHash = await bcrypt.hash(password, 10);
  }

  if (fullName !== undefined) patch.fullName = fullName;
  if (email !== undefined) patch.email = email;
  if (department !== undefined) patch.department = department;

  // Protect super_admin modification: prevent demoting superadmin account
  if (admin.username === "superadmin" && role && role !== "super_admin") {
    res.status(400).json({ message: "The primary superadmin account cannot be demoted." });
    return;
  }

  if (role) patch.role = role;
  if (Array.isArray(permissions)) patch.permissions = permissions;

  const updated = Users.update(adminId, patch);

  if (req.user) {
    ActivityLog.add(req.user.id, "ADMIN_UPDATED", {
      updatedAdminId: adminId,
      updatedUsername: updated?.username,
      fields: Object.keys(patch),
    });
  }

  res.json({ message: "Admin account updated.", admin: updated });
});

// ── POST /api/admins/:id/toggle-lock ─────────────────────────────────
// Super Admin locks or unlocks an Admin account
router.post("/:id/toggle-lock", authenticateToken, requireSuperAdmin, (req: AuthRequest, res: Response): void => {
  const adminId = req.params.id;
  const admin = Users.findById(adminId);

  if (!admin) {
    res.status(404).json({ message: "Admin account not found." });
    return;
  }

  if (admin.role === "super_admin") {
    res.status(400).json({ message: "Super Admin accounts cannot be locked." });
    return;
  }

  const newLockState = !admin.isLocked;
  Users.update(adminId, { isLocked: newLockState });

  if (req.user) {
    ActivityLog.add(req.user.id, "ADMIN_LOCK_TOGGLED", {
      adminId,
      username: admin.username,
      isLocked: newLockState,
    });
  }

  res.json({ message: `Admin account ${newLockState ? "locked" : "unlocked"}.`, isLocked: newLockState });
});

// ── DELETE /api/admins/:id ───────────────────────────────────────────
// Super Admin deletes an Admin account
router.delete("/:id", authenticateToken, requireSuperAdmin, (req: AuthRequest, res: Response): void => {
  const adminId = req.params.id;
  const admin = Users.findById(adminId);

  if (!admin) {
    res.status(404).json({ message: "Admin account not found." });
    return;
  }

  if (admin.role === "super_admin") {
    res.status(400).json({ message: "Super Admin accounts cannot be deleted." });
    return;
  }

  Users.remove(adminId);

  if (req.user) {
    ActivityLog.add(req.user.id, "ADMIN_DELETED", { adminId, username: admin.username });
  }

  res.json({ message: "Admin account deleted." });
});

export default router;
