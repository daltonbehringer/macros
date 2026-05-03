import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Macros — tracking, in plain language",
  description:
    "The food tracker that listens. Tell it what you ate; it does the math. No barcode scanner, no 800,000-item food database, no friend feed.",
  appleWebApp: {
    capable: true,
    title: "Macros",
    statusBarStyle: "black-translucent",
  },
};

// Theme-color drives browser/OS chrome (the URL bar on Android Chrome, the
// status bar in iOS standalone mode). Match the user's color scheme so the
// chrome blends with the page rather than fighting it. Accent green stays a
// brand pop, not chrome.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

// Inline the theme decision before React hydrates so the page never flashes
// the wrong theme. Reads localStorage('theme'), then falls back to system pref.
const themeScript = `(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) {}
})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authenticated = cookieStore.has("macros_session");

  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-white font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
        <BottomNav authenticated={authenticated} />
        <Analytics />
      </body>
    </html>
  );
}
