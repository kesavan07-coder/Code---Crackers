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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
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

