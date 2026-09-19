import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { THEME_KEY } from "@/components/shell/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mizizi",
  description: "Explore Kenya's languages, cultures and literary heritage.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme is set before paint by the script below, which React would
      // otherwise flag as a mismatch against the server's bare <html>.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Applies the remembered theme before any Next.js module runs, so a
            dark-mode visitor never gets a white flash. `next/script` with
            beforeInteractive injects it into the initial HTML; a bare <script>
            here would be a React render-time script, which React warns about. */}
        <Script id="mizizi-theme" strategy="beforeInteractive">
          {`try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
