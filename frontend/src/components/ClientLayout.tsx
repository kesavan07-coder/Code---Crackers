"use client";

import { useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [loaderDone, setLoaderDone] = useState(false);

  return (
    <>
      {/* Loading screen shows on every page load / refresh */}
      {!loaderDone && (
        <LoadingScreen onComplete={() => setLoaderDone(true)} />
      )}

      {/* Main content fades in as loader exits */}
      <div
        style={{
          opacity: loaderDone ? 1 : 0,
          transition: loaderDone ? "opacity 0.4s ease 0.1s" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
