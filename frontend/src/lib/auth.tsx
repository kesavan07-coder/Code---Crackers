"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ── Types ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  role: "admin" | "participant";
  department?: string;
  email?: string;
  fullName?: string;
  firstLoginCompleted?: boolean;
  needsNameSetup?: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, skipRedirect?: boolean) => Promise<{ success: boolean; error?: string; needsNameSetup?: boolean }>;
  updateProfile: (fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously pre-seed state from localStorage so pages never see null token on refresh
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("cc_token");
  });
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem("cc_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount: verify token in background — only clear on explicit 401/403, not on network errors
  useEffect(() => {
    const storedToken = localStorage.getItem("cc_token");
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          // Token is genuinely expired or invalid — clear session
          localStorage.removeItem("cc_token");
          localStorage.removeItem("cc_user");
          setToken(null);
          setUser(null);
          return;
        }
        if (!r.ok) {
          // Network/server error — keep existing session, don't log out
          return;
        }
        const userData: User = await r.json();
        setToken(storedToken);
        setUser(userData);
        // Persist refreshed user info for next page load
        localStorage.setItem("cc_user", JSON.stringify(userData));
      })
      .catch(() => {
        // Network error (backend unreachable, etc.) — keep session alive
        // Do NOT clear token on network failure
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string, skipRedirect = false): Promise<{ success: boolean; error?: string; needsNameSetup?: boolean }> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.message || "Login failed." };
        }

        // Session conflict — another device logged in
        if (data.code === "SESSION_CONFLICT") {
          return { success: false, error: "Your session was invalidated from another device." };
        }

        localStorage.setItem("cc_token", data.token);
        localStorage.setItem("cc_user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);

        const needsNameSetup = data.needsNameSetup || false;

        // Role-based redirect unless caller asked to skip
        if (!skipRedirect && !needsNameSetup) {
          if (data.user.role === "admin") {
            router.push("/admin");
          } else {
            router.push("/dashboard");
          }
        }

        return { success: true, needsNameSetup };
      } catch {
        return { success: false, error: "Network error. Please check your connection." };
      }
    },
    [router]
  );

  const updateProfile = useCallback(
    async (fullName: string): Promise<{ success: boolean; error?: string }> => {
      if (!token) return { success: false, error: "Not logged in." };
      try {
        const res = await fetch(`${API_BASE}/api/auth/update-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fullName }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || "Failed to update profile." };
        }
        setUser(data.user);
        localStorage.setItem("cc_user", JSON.stringify(data.user));
        return { success: true };
      } catch {
        return { success: false, error: "Server connection error." };
      }
    },
    [token]
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Fire-and-forget: clear locally even if request fails
      }
    }
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_user");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [token, router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
