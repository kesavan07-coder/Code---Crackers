"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Questions", href: "/admin/questions" },
  { label: "Participants", href: "/admin/participants" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) router.replace("/login");
    if (!isLoading && user && user.role !== "admin") router.replace("/dashboard");
  }, [token, user, isLoading, router]);

  return (
    <>
      {/* Shared Admin Header — pages override their own header, so this is intentionally minimal */}
      {children}
    </>
  );
}
