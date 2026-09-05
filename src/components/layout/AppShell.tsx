"use client";

// Chooses the right chrome for each route.
// Login stays full-bleed with no header; everything else gets the app shell.

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";

interface AppShellProps {
  children: React.ReactNode;
  signedIn?: boolean;
}

export function AppShell({ children, signedIn = false }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <>
      <AppHeader signedIn={signedIn} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
