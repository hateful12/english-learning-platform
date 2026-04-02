/** Simple shapes for low-level readers: mic = speak; document lines = read; book = grammar study. */

export function ExerciseTypeGlyph({
  exerciseId,
  className = "h-6 w-6",
}: {
  exerciseId: string;
  className?: string;
}) {
  if (exerciseId === "speaking-prep") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
      </svg>
    );
  }
  if (exerciseId === "reading") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm2 4h8v1.5H8V7zm0 3h8v1.5H8V10zm0 3h8v1.5H8V13z" />
      </svg>
    );
  }
  if (exerciseId === "grammar") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M5 3h6a1 1 0 011 1v15a1 1 0 01-1 1H5a2 2 0 01-2-2V5a2 2 0 012-2zm8 0h6a2 2 0 012 2v13a2 2 0 01-2 2h-6V3zM6.5 7h4v1.5h-4V7zm0 3h4v1.5h-4V10zm8 2.5h4V15h-4v-1.5z" />
      </svg>
    );
  }
  return null;
}
