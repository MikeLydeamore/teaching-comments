export const THEME_STORAGE_KEY = "edie_theme";

export const themes = [
  { label: "Default", value: "default" },
  { label: "Flatly", value: "flatly" },
  { label: "Minty", value: "minty" },
  { label: "Cerulean", value: "cerulean" },
  { label: "Pulse", value: "pulse" },
  { label: "Solar", value: "solar" },
  { label: "Amethyst", value: "amethyst" },
  { label: "Midnight", value: "midnight" },
  { label: "Blush", value: "blush" },
  { label: "Darkly", value: "darkly" },
] as const;

export type ThemeName = (typeof themes)[number]["value"];

export const DARK_THEMES: readonly ThemeName[] = ["darkly", "midnight"];

export const THEME_FAVICON_PATHS: Record<ThemeName, string> = {
  default: "/favicons/lightbulb-default.svg",
  flatly: "/favicons/lightbulb-flatly.svg",
  minty: "/favicons/lightbulb-minty.svg",
  cerulean: "/favicons/lightbulb-cerulean.svg",
  pulse: "/favicons/lightbulb-pulse.svg",
  solar: "/favicons/lightbulb-solar.svg",
  amethyst: "/favicons/lightbulb-amethyst.svg",
  midnight: "/favicons/lightbulb-midnight.svg",
  blush: "/favicons/lightbulb-blush.svg",
  darkly: "/favicons/lightbulb-darkly.svg",
};

export function isThemeName(value: string | null): value is ThemeName {
  return themes.some((theme) => theme.value === value);
}

export function storedTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "default";
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeName(value) ? value : "default";
}

export function faviconPath(theme: ThemeName) {
  return THEME_FAVICON_PATHS[theme];
}

function applyFavicon(theme: ThemeName) {
  const favicon = document.querySelector<HTMLLinkElement>("#edie-favicon");
  if (favicon) {
    favicon.href = faviconPath(theme);
  }
}

export function applyTheme(theme: ThemeName) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-edie-theme");
    document.documentElement.style.colorScheme = "light";
  } else {
    document.documentElement.dataset.edieTheme = theme;
    document.documentElement.style.colorScheme = DARK_THEMES.includes(theme)
      ? "dark"
      : "light";
  }

  applyFavicon(theme);
}
