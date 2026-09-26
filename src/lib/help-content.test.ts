import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { helpHeadingId, parseHelpArticle } from "./help-content";

describe("help content", () => {
  it("parses article metadata and searchable sections", () => {
    const article = parseHelpArticle(
      "first-session",
      `---
title: Run your first session
summary: Start collecting responses.
audience: host
category: Getting started
order: 2
reviewed: 2026-09-26
---

## Before you begin

Open a hosted space.

## Invite participants

Share the QR code.`,
    );

    expect(article.title).toBe("Run your first session");
    expect(article.order).toBe(2);
    expect(article.reviewed).toBe("2026-09-26");
    expect(article.sections).toEqual([
      {
        id: "before-you-begin",
        searchText: "open a hosted space.",
        title: "Before you begin",
      },
      {
        id: "invite-participants",
        searchText: "share the qr code.",
        title: "Invite participants",
      },
    ]);
  });

  it("creates stable heading ids", () => {
    expect(helpHeadingId("Export, clear & archive a session")).toBe(
      "export-clear-archive-a-session",
    );
  });
});
