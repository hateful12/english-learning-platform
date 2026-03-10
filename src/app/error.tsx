"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card max-w-lg p-6">
        <h2 className="font-serif text-xl font-semibold text-ink">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        {process.env.NODE_ENV === "development" && error.stack && (
          <pre className="mt-4 overflow-auto text-xs text-ink/60">{error.stack}</pre>
        )}
        <button
          type="button"
          onClick={reset}
          className="btn-primary mt-4"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
