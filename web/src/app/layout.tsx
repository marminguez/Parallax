import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

// Self-hosted so the app builds and runs without reaching Google Fonts (venue Wi-Fi, offline demos).
const instrumentSerif = localFont({
  src: [
    { path: "../fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parallax — the Moon and Mars, found on Earth",
  description:
    "Parallax measures the terrain of Earth, the lunar south pole and all of Mars with NASA data, and finds each place's twin on the other worlds.",
  // Kept out of search engines until the team decides to publish (PARALLAX_NOINDEX=0 lifts it).
  robots: process.env.PARALLAX_NOINDEX === "0" ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
