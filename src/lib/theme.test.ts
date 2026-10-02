import { accessSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  faviconPath,
  themes,
  THEME_FAVICON_PATHS,
} from "./theme";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("theme favicons", () => {
  it("provides a public SVG for every theme", () => {
    expect(Object.keys(THEME_FAVICON_PATHS)).toEqual(
      themes.map(({ value }) => value),
    );

    for (const { value } of themes) {
      expect(() =>
        accessSync(`public${faviconPath(value)}`),
      ).not.toThrow();
    }
  });

  it("changes the favicon with the active theme", () => {
    const favicon = { href: "" };
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: { colorScheme: "" },
      removeAttribute: vi.fn(),
    };
    vi.stubGlobal("document", {
      documentElement,
      querySelector: vi.fn().mockReturnValue(favicon),
    });

    applyTheme("solar");

    expect(documentElement.dataset.edieTheme).toBe("solar");
    expect(documentElement.style.colorScheme).toBe("light");
    expect(favicon.href).toBe("/favicons/lightbulb-solar.svg");
  });
});
