"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  storedTheme,
  themes,
  type ThemeName,
} from "@/lib/theme";

export function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeName>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("edie_theme", theme);
  }, [theme]);

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="edie-theme">
        Appearance
      </label>
      <select
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        id="edie-theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemeName)}
      >
        {themes.map((themeOption) => (
          <option key={themeOption.value} value={themeOption.value}>
            {themeOption.label}
          </option>
        ))}
      </select>
    </div>
  );
}
