import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen antialiased">
        <LocaleProvider>
          <AppHeader />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
