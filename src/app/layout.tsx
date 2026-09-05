import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { isAuthConfigured } from "@/lib/auth/cognito-config";
import { ID_TOKEN_COOKIE } from "@/lib/auth/session";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlashcardAI",
  description: "Personal flashcards from PDFs with spaced repetition",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Show the sign-out button only when auth is enabled and a session cookie
  // exists. The middleware does the real verification; this is just for UI.
  const signedIn = isAuthConfigured() && (await cookies()).has(ID_TOKEN_COOKIE);

  return (
    <html lang="sv" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen antialiased">
        <LocaleProvider>
          <AppShell signedIn={signedIn}>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
