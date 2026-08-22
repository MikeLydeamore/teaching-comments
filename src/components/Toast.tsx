"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_DURATION_MS = 4000;
const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id),
    );
  }, []);

  const pushToast = useCallback(
    (message: string, variant: ToastVariant) => {
      nextToastIdRef.current += 1;
      const id = nextToastIdRef.current;

      setToasts((currentToasts) => [
        ...currentToasts.slice(-(MAX_VISIBLE_TOASTS - 1)),
        { id, message, variant },
      ]);
      window.setTimeout(() => removeToast(id), TOAST_DURATION_MS);
    },
    [removeToast],
  );

  const toastApi = useMemo<ToastApi>(
    () => ({
      error: (message) => pushToast(message, "error"),
      success: (message) => pushToast(message, "success"),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm font-medium shadow-sm ${
              toast.variant === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
            key={toast.id}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);

  if (!toast) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return toast;
}
