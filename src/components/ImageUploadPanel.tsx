"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;
const HEIC_EXTENSION = /\.(heic|heif)$/i;

export type PreparedImage = { blob: Blob; contentType: "image/png" | "image/jpeg" | "image/webp"; previewUrl: string };

export function outputImageContentType(value: string): PreparedImage["contentType"] {
  if (value === "image/png" || value === "image/jpeg" || value === "image/webp") return value;
  throw new Error("Your browser produced an unsupported image format.");
}

async function decodeSource(file: File): Promise<Blob> {
  if (isHeic(file)) {
    const { heicTo } = await import("heic-to");
    return heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  }
  return file;
}

function isHeic(file: File) {
  return file.type === "image/heic" || file.type === "image/heif" || ((!file.type || file.type === "application/octet-stream") && HEIC_EXTENSION.test(file.name));
}

function accepted(file: File) {
  return ACCEPTED.includes(file.type) || isHeic(file);
}

export async function normalizeImage(file: File): Promise<PreparedImage> {
  if (!accepted(file)) throw new Error("Choose a PNG, JPEG, WebP, HEIC, or HEIF image.");
  if (file.size > MAX_BYTES) throw new Error("The original image must be 10 MiB or smaller.");
  const source = await decodeSource(file);
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const contentType: PreparedImage["contentType"] = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, contentType, contentType === "image/png" ? undefined : 0.9));
  if (!blob) throw new Error("Your browser could not prepare this image.");
  if (blob.size > MAX_BYTES) throw new Error("The prepared image is larger than 10 MiB.");
  return { blob, contentType: outputImageContentType(blob.type), previewUrl: URL.createObjectURL(blob) };
}

export function ImageUploadPanel({ disabled, image, onChange, onProcessingChange }: { disabled: boolean; image: PreparedImage | null; onChange: (image: PreparedImage | null) => void; onProcessingChange: (processing: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const preparationId = useRef(0);
  const imageRef = useRef(image);
  useEffect(() => {
    const previous = imageRef.current;
    if (previous && previous !== image) URL.revokeObjectURL(previous.previewUrl);
    imageRef.current = image;
  }, [image]);
  useEffect(() => () => { if (imageRef.current) URL.revokeObjectURL(imageRef.current.previewUrl); }, []);
  async function select(file?: File) {
    if (!file || disabled || isPreparing) return;
    const id = ++preparationId.current;
    setIsPreparing(true); onProcessingChange(true); setError(""); setStatus("Preparing image and stripping metadata…");
    try {
      const next = await normalizeImage(file);
      if (id !== preparationId.current) { URL.revokeObjectURL(next.previewUrl); return; }
      onChange(next);
      setStatus("Image ready. It will upload when you submit.");
    }
    catch (reason) { if (id === preparationId.current) { setError(reason instanceof Error ? reason.message : "Could not prepare that image."); setStatus(""); } }
    finally { if (id === preparationId.current) { setIsPreparing(false); onProcessingChange(false); } }
  }
  function onInput(event: ChangeEvent<HTMLInputElement>) { void select(event.target.files?.[0]); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void select([...event.dataTransfer.files].find((file) => accepted(file))); }
  useEffect(() => {
    const onDocumentPaste = (event: ClipboardEvent) => {
      const file = event.clipboardData ? [...event.clipboardData.files].find((item) => accepted(item)) : undefined;
      if (file) { event.preventDefault(); void select(file); }
    };
    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  });
  function remove() { preparationId.current += 1; onChange(null); setStatus(""); setIsPreparing(false); onProcessingChange(false); }
  return <div className="mt-5">
    <p className="text-sm font-semibold text-slate-700">Private image (optional)</p>
    <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      {image ? <><img alt="Selected upload preview" className="max-h-64 rounded-md border border-slate-200" src={image.previewUrl} /><div className="mt-3 flex items-center gap-3"><span className="text-sm text-slate-600">{image.contentType} · {(image.blob.size / 1024).toFixed(0)} KiB</span><button className="text-sm font-semibold text-teal-700 underline" disabled={disabled || isPreparing} type="button" onClick={() => input.current?.click()}>Replace image</button><button className="text-sm font-semibold text-teal-700 underline" disabled={disabled} type="button" onClick={remove}>Remove image</button></div></> : <><p className="text-sm text-slate-600">Drag an image here, paste one, or choose a file. PNG, JPEG, WebP, HEIC, or HEIF up to 10 MiB.</p><button className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" disabled={disabled || isPreparing} type="button" onClick={() => input.current?.click()}>Choose image</button></>}
      <input accept=".png,.jpg,.jpeg,.webp,.heic,.heif,image/png,image/jpeg,image/webp,image/heic,image/heif" className="hidden" disabled={disabled || isPreparing} ref={input} type="file" onChange={onInput} />
    </div>
    {status ? <p aria-live="polite" className="mt-2 text-sm text-slate-600">{status}</p> : null}{error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
  </div>;
}
