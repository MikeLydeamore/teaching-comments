"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { DRAWING_HEIGHT, DRAWING_WIDTH, renderDrawing } from "@/lib/drawing-render";
import type { DrawingData, DrawingPoint, DrawingStroke } from "@/lib/qwt-store";

const COLORS = [
  { label: "Black", value: "#0f172a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Red", value: "#dc2626" },
  { label: "Teal", value: "#0f766e" },
];

type DrawingPadProps = {
  disabled?: boolean;
  onChange: (drawingData: DrawingData | null) => void;
};

function distance(a: DrawingPoint, b: DrawingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function DrawingPad({ disabled = false, onChange }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(4);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    renderDrawing(context, {
      version: 1,
      width: DRAWING_WIDTH,
      height: DRAWING_HEIGHT,
      strokes,
    });
  }, [strokes]);

  useEffect(() => {
    onChange(
      strokes.length
        ? {
            version: 1,
            width: DRAWING_WIDTH,
            height: DRAWING_HEIGHT,
            strokes,
          }
        : null,
    );
  }, [onChange, strokes]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * DRAWING_HEIGHT,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }

    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);

    setStrokes((currentStrokes) => [
      ...currentStrokes,
      {
        color,
        size,
        points: [point],
      },
    ]);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || pointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const point = pointFromEvent(event);

    setStrokes((currentStrokes) => {
      const activeStroke = currentStrokes.at(-1);

      if (!activeStroke) {
        return currentStrokes;
      }

      const previousPoint = activeStroke.points.at(-1);

      if (previousPoint && distance(previousPoint, point) < 1.5) {
        return currentStrokes;
      }

      return [
        ...currentStrokes.slice(0, -1),
        {
          ...activeStroke,
          points: [...activeStroke.points, point],
        },
      ];
    });
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    pointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-700" htmlFor="quick-draw">
          Drawing
        </label>
        <p className="text-xs text-slate-500">
          {strokes.length ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}` : "Optional"}
        </p>
      </div>

      <canvas
        aria-label="Drawing response"
        className="mt-3 block w-full rounded-md border border-slate-300 bg-white shadow-inner [touch-action:none]"
        height={DRAWING_HEIGHT}
        id="quick-draw"
        ref={canvasRef}
        style={{ aspectRatio: `${DRAWING_WIDTH} / ${DRAWING_HEIGHT}` }}
        width={DRAWING_WIDTH}
        onPointerCancel={finishStroke}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Drawing color">
          {COLORS.map((option) => (
            <button
              aria-label={option.label}
              className={`size-8 rounded-full border-2 transition ${
                color === option.value ? "border-slate-950" : "border-slate-300"
              }`}
              disabled={disabled}
              key={option.value}
              style={{ backgroundColor: option.value }}
              type="button"
              onClick={() => setColor(option.value)}
            />
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span>Pen</span>
          <input
            className="w-24 accent-teal-700"
            disabled={disabled}
            max={12}
            min={2}
            type="range"
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>

        <div className="ml-auto flex gap-2">
          <button
            className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !strokes.length}
            type="button"
            onClick={() => setStrokes((currentStrokes) => currentStrokes.slice(0, -1))}
          >
            Undo
          </button>
          <button
            className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !strokes.length}
            type="button"
            onClick={() => setStrokes([])}
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
