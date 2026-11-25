import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { PortalProvider } from "@/lib/portalContext";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Code Crackers – Technical Quiz",
  description:
    "Live technical quiz and competition platform. Compete in MCQ, coding, and debugging rounds.",
  keywords: ["coding competition", "technical quiz", "symposium", "hackathon", "MCQ"],
  icons: {
    icon: "/college_logo.png",
    shortcut: "/college_logo.png",
    apple: "/college_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PortalProvider>
          <AuthProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </AuthProvider>
        </PortalProvider>
      </body>
    </html>
  );
}

