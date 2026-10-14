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
        <link href="https://db.onlinewebfonts.com/c/1cd1e7d71e048159076fd90b39846902?family=Open+Sauce+One" rel="stylesheet" />
        <link href="https://db.onlinewebfonts.com/c/42acf9aa4a6dc2f2886a3f682e337ead?family=Open+Sauce+One+Bold" rel="stylesheet" />
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

