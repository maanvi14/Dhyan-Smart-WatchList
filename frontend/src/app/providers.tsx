"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <I18nProvider>
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}
