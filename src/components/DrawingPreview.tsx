"use client";

import { useEffect, useRef, useState } from "react";
import { DRAWING_HEIGHT, DRAWING_WIDTH, renderDrawing } from "@/lib/drawing-render";
import type { DrawingData } from "@/lib/qwt-store";

type DrawingCanvasProps = {
  drawingData: DrawingData;
};

function DrawingCanvas({ drawingData }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    renderDrawing(context, drawingData);
  }, [drawingData]);

  return (
    <canvas
      aria-label="Student drawing"
      className="block w-full rounded-md border border-slate-200 bg-white"
      height={DRAWING_HEIGHT}
      ref={canvasRef}
      style={{ aspectRatio: `${DRAWING_WIDTH} / ${DRAWING_HEIGHT}` }}
      width={DRAWING_WIDTH}
    />
  );
}

export function DrawingPreview({ drawingData }: DrawingCanvasProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        aria-label="Open drawing preview"
        className="mt-3 block w-full rounded-md border border-slate-200 bg-white p-1 text-left transition hover:border-teal-500"
        type="button"
        onClick={() => setExpanded(true)}
      >
        <DrawingCanvas drawingData={drawingData} />
      </button>

      {expanded ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5"
          role="dialog"
        >
          <div className="w-full max-w-5xl rounded-md bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Drawing response</p>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={() => setExpanded(false)}
              >
                Close
              </button>
            </div>
            <DrawingCanvas drawingData={drawingData} />
          </div>
        </div>
      ) : null}
    </>
  );
}
