/* eslint-disable @next/next/no-img-element */

import type { GifData } from "@/lib/qwt-store";

type GifPreviewProps = {
  gifData: GifData;
  onRemove?: () => void;
  variant?: "student" | "teacher";
};

export function GifPreview({
  gifData,
  onRemove,
  variant = "teacher",
}: GifPreviewProps) {
  const imageUrl = variant === "student" ? gifData.previewUrl : gifData.url;
  const altText = gifData.title ? `${gifData.title} GIF` : "Selected GIF from GIPHY";

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      <a
        className="block bg-white"
        href={gifData.giphyUrl}
        rel="noreferrer"
        target="_blank"
      >
        <img
          alt={altText}
          className="mx-auto block max-h-64 w-full object-contain"
          height={gifData.height}
          src={imageUrl}
          style={{ aspectRatio: `${gifData.width} / ${gifData.height}` }}
          width={gifData.width}
        />
      </a>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Powered by GIPHY
        </p>
        {onRemove ? (
          <button
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
            type="button"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
