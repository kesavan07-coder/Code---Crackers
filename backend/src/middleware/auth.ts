import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Users } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "code_crackers_secret_key_2026_xyz";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: "super_admin" | "admin" | "participant";
    permissions?: string[];
    sessionToken: string;
  };
}

// ── JWT Verification + Single-session check ──────────────────────────
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access token is missing." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: "super_admin" | "admin" | "participant";
      permissions?: string[];
      sessionToken: string;
    };

    const user = Users.findById(decoded.id);

    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    if (user.isLocked) {
      res.status(403).json({ message: "Your account is locked by the admin." });
      return;
    }

    if (user.loginEnabled === false) {
      res.status(403).json({ message: "Your login has been disabled by the admin." });
      return;
    }

    // Single-session enforcement
    const { singleDeviceLoginEnabled } = require("../config/database").Competition.get();
    if (singleDeviceLoginEnabled && user.currentSessionToken !== decoded.sessionToken) {
      res.status(401).json({
        message: "Session expired. You have logged in from another location.",
        code: "SESSION_CONFLICT",
      });
      return;
    }

    req.user = {
      ...decoded,
      permissions: user.permissions || [],
    };
    next();
  } catch {
    res.status(403).json({ message: "Invalid or expired token." });
  }
};

// ── Admin-only guard (allows both super_admin and admin) ─────────────
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "super_admin")) {
    res.status(403).json({ message: "Admin access required." });
    return;
  }
  next();
};

// ── Super Admin-only guard ──────────────────────────────────────────
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== "super_admin") {
    res.status(403).json({ message: "Super Admin authorization required." });
    return;
  }
  next();
};

// ── Permission Guard ────────────────────────────────────────────────
export const requirePermission = (permissionKey: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }
    if (req.user.role === "super_admin") {
      next(); // Super admin has all permissions implicitly
      return;
    }
    if (req.user.role === "admin" && req.user.permissions?.includes(permissionKey)) {
      next();
      return;
    }
    res.status(403).json({ message: `Access denied. Requires '${permissionKey}' permission.` });
  };
};

