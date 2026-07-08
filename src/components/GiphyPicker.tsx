/* eslint-disable @next/next/no-img-element */

"use client";

import { useState } from "react";
import { GifPreview } from "@/components/GifPreview";
import type { GifData } from "@/lib/qwt-store";

type GiphyPickerProps = {
  disabled?: boolean;
  gifData: GifData | null;
  onChange: (gifData: GifData | null) => void;
};

type GiphyRendition = {
  height?: string;
  url?: string;
  width?: string;
};

type GiphyApiGif = {
  id?: string;
  images?: {
    downsized?: GiphyRendition;
    fixed_height?: GiphyRendition;
    fixed_height_small?: GiphyRendition;
    fixed_width_small?: GiphyRendition;
    original?: GiphyRendition;
    preview_gif?: GiphyRendition;
  };
  title?: string;
  url?: string;
};

type GiphySearchResponse = {
  data?: GiphyApiGif[];
};

const giphyApiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

function toNumber(value: string | undefined, fallback: number) {
  const number = value ? Number(value) : fallback;

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function toGifData(gif: GiphyApiGif): GifData | null {
  const id = gif.id?.trim();
  const image = gif.images?.fixed_height ?? gif.images?.downsized ?? gif.images?.original;
  const preview =
    gif.images?.fixed_width_small ??
    gif.images?.fixed_height_small ??
    gif.images?.preview_gif ??
    image;

  if (!id || !image?.url || !preview?.url) {
    return null;
  }

  return {
    id,
    title: gif.title?.trim() || "GIPHY GIF",
    url: image.url,
    previewUrl: preview.url,
    giphyUrl: gif.url || `https://giphy.com/gifs/${id}`,
    width: toNumber(image.width, 320),
    height: toNumber(image.height, 180),
  };
}

export function GiphyPicker({ disabled = false, gifData, onChange }: GiphyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifData[]>([]);
  const [status, setStatus] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const isConfigured = Boolean(giphyApiKey);

  async function searchGiphy() {
    const trimmedQuery = query.trim();

    if (!isConfigured) {
      setStatus("Add NEXT_PUBLIC_GIPHY_API_KEY to enable GIF search.");
      return;
    }

    if (trimmedQuery.length < 2) {
      setStatus("Type at least two characters to search.");
      return;
    }

    setIsSearching(true);
    setStatus("");

    try {
      const params = new URLSearchParams({
        api_key: giphyApiKey,
        lang: "en",
        limit: "12",
        q: trimmedQuery,
        rating: "g",
      });
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("GIPHY search failed.");
      }

      const payload = (await response.json()) as GiphySearchResponse;
      const nextResults = (payload.data ?? [])
        .map(toGifData)
        .filter((gif): gif is GifData => Boolean(gif));

      setResults(nextResults);
      setStatus(nextResults.length ? "" : "No GIFs found.");
    } catch {
      setStatus("Could not search GIFs right now.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          aria-expanded={isOpen}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span
            aria-hidden="true"
            className="rounded border border-current px-1.5 py-0.5 text-[10px] font-black leading-none"
          >
            GIF
          </span>
          Add GIF
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Powered by GIPHY
        </p>
      </div>

      {gifData ? (
        <GifPreview
          gifData={gifData}
          variant="student"
          onRemove={() => onChange(null)}
        />
      ) : null}

      {isOpen ? (
        <div className="mt-3">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="giphy-search">
              Search GIPHY
            </label>
            <input
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              disabled={!isConfigured || disabled}
              id="giphy-search"
              maxLength={50}
              placeholder={isConfigured ? "Search GIFs..." : "Add a GIPHY API key first"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchGiphy();
                }
              }}
            />
            <button
              className="h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isConfigured || disabled || isSearching}
              type="button"
              onClick={() => {
                void searchGiphy();
              }}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {status ? (
            <p className="mt-2 text-sm font-medium text-slate-600">{status}</p>
          ) : null}

          {results.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((gif) => (
                <button
                  aria-label={`Select ${gif.title}`}
                  className="group overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left transition hover:border-teal-500 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-100"
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onChange(gif);
                    setIsOpen(false);
                    setStatus("");
                  }}
                >
                  <img
                    alt={gif.title ? `${gif.title} GIF` : "GIPHY search result"}
                    className="aspect-video w-full rounded object-cover"
                    height={gif.height}
                    src={gif.previewUrl}
                    width={gif.width}
                  />
                  <span className="mt-1 block truncate px-1 pb-1 text-xs font-medium text-slate-500 group-hover:text-teal-800">
                    {gif.title || "GIPHY GIF"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
