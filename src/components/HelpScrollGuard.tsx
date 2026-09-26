"use client";

import { useLayoutEffect } from "react";

export function HelpScrollGuard() {
  useLayoutEffect(() => {
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }, []);

  return null;
}
