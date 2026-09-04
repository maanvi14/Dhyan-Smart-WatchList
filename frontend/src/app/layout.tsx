import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Dhyan — Smart Market Watchlist",
  description: "Smart stock watchlist for Indian retail investors with verified confidence tiers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-brand-500 selection:text-slate-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
