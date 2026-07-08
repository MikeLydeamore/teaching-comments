"use client";

import { useEffect, useState } from "react";

const storageKey = "qwt_theme";

const themes = [
  { label: "Default", value: "default" },
  { label: "Flatly", value: "flatly" },
  { label: "Minty", value: "minty" },
  { label: "Cerulean", value: "cerulean" },
  { label: "Pulse", value: "pulse" },
  { label: "Darkly", value: "darkly" },
] as const;

type ThemeName = (typeof themes)[number]["value"];

function isThemeName(value: string | null): value is ThemeName {
  return themes.some((theme) => theme.value === value);
}

function storedTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "default";
  }

  const value = window.localStorage.getItem(storageKey);
  return isThemeName(value) ? value : "default";
}

function applyTheme(theme: ThemeName) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-qwt-theme");
    document.documentElement.style.colorScheme = "light";
  } else {
    document.documentElement.dataset.qwtTheme = theme;
    document.documentElement.style.colorScheme = theme === "darkly" ? "dark" : "light";
  }
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<ThemeName>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  return (
    <div className="qwt-theme-selector fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <label className="font-semibold text-slate-600" htmlFor="qwt-theme">
        Theme
      </label>
      <select
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        id="qwt-theme"
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
