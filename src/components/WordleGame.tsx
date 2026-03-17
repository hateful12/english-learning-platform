"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDailyWord, WORDLE_WORDS } from "@/lib/wordle-words";

const ROWS = 6;
const COLS = 5;

type LetterStatus = "correct" | "present" | "absent" | null;

function computeFeedback(guess: string, target: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(COLS).fill(null);
  const targetCounts: Record<string, number> = {};
  for (const c of target) {
    targetCounts[c] = (targetCounts[c] ?? 0) + 1;
  }
  // First pass: mark correct
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
      targetCounts[guess[i]]--;
    }
  }
  // Second pass: mark present (yellow)
  for (let i = 0; i < COLS; i++) {
    if (result[i]) continue;
    const c = guess[i];
    if (target.includes(c) && (targetCounts[c] ?? 0) > 0) {
      result[i] = "present";
      targetCounts[c]--;
    } else {
      result[i] = "absent";
    }
  }
  return result;
}

const KEYBOARD_ROWS = [
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

const STORAGE_KEY = "wordle-state";

type StoredState = {
  date: string;
  guesses: string[];
  status: "playing" | "won" | "lost";
};

function loadState(targetDate: string): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.date !== targetDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

type WordleGameProps = {
  onGameEnd?: (date: string, result: "won" | "lost", tries: number) => void;
};

export function WordleGame({ onGameEnd }: WordleGameProps) {
  const [targetDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [target] = useState(() => getDailyWord(new Date(targetDate)));
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [invalidMessage, setInvalidMessage] = useState("");

  useEffect(() => {
    const saved = loadState(targetDate);
    if (saved) {
      setGuesses(saved.guesses);
      setStatus(saved.status);
    }
  }, [targetDate]);

  useEffect(() => {
    if (guesses.length === 0 && status === "playing") return;
    saveState({ date: targetDate, guesses, status });
  }, [targetDate, guesses, status]);

  const submittedRef = useRef<string | null>(null);
  useEffect(() => {
    submittedRef.current = null;
  }, [targetDate]);
  useEffect(() => {
    if (!onGameEnd || submittedRef.current === targetDate) return;
    if (status === "won" && guesses.length > 0) {
      submittedRef.current = targetDate;
      onGameEnd(targetDate, "won", guesses.length);
    } else if (status === "lost" && guesses.length >= ROWS) {
      submittedRef.current = targetDate;
      onGameEnd(targetDate, "lost", 7);
    }
  }, [status, targetDate, guesses.length, onGameEnd]);

  const submitGuess = useCallback(() => {
    const word = currentGuess.toLowerCase().trim();
    if (word.length !== COLS) {
      setInvalidMessage("Word must be 5 letters");
      setTimeout(() => setInvalidMessage(""), 2000);
      return;
    }
    if (!WORDLE_WORDS.includes(word)) {
      setInvalidMessage("Not in word list");
      setTimeout(() => setInvalidMessage(""), 2000);
      return;
    }

    setInvalidMessage("");
    const next = [...guesses, word];
    setGuesses(next);
    setCurrentGuess("");

    if (word === target) {
      setStatus("won");
    } else if (next.length >= ROWS) {
      setStatus("lost");
    }
  }, [currentGuess, guesses, target]);

  const handleKey = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      setInvalidMessage("");
      const k = key.toLowerCase();
      if (k === "enter") {
        submitGuess();
      } else if (k === "backspace") {
        setCurrentGuess((g) => g.slice(0, -1));
      } else if (k.length === 1 && /^[a-z]$/.test(k)) {
        setCurrentGuess((g) => (g.length < COLS ? g + k : g));
      }
    },
    [status, submitGuess]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      handleKey(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const keyStatus: Record<string, LetterStatus> = {};
  for (const g of guesses) {
    const fb = computeFeedback(g, target);
    for (let i = 0; i < COLS; i++) {
      const c = g[i];
      const s = fb[i];
      if (!keyStatus[c] || (s === "correct") || (s === "present" && keyStatus[c] === "absent")) {
        keyStatus[c] = s;
      }
    }
  }

  const allGuesses = [...guesses];
  if (status === "playing" && currentGuess) {
    allGuesses.push(currentGuess.padEnd(COLS, " "));
  }
  while (allGuesses.length < ROWS) {
    allGuesses.push("".padEnd(COLS, " "));
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center">
        <h2 className="font-serif text-2xl font-semibold text-ink">Wordle</h2>
        <p className="text-sm text-ink/60 mt-1">Guess the 5-letter word in 6 tries</p>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-1.5">
        {allGuesses.slice(0, ROWS).map((row, ri) => (
          <div key={ri} className="flex gap-1.5 justify-center">
            {Array.from({ length: COLS }, (_, ci) => {
              const letter = row[ci]?.trim() ?? "";
              const feedback = ri < guesses.length ? computeFeedback(guesses[ri], target)[ci] : null;
              const isCurrent = ri === guesses.length && letter;
              return (
                <div
                  key={ci}
                  className={`
                    w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
                    text-xl font-bold uppercase rounded-lg border-2
                    ${feedback === "correct" ? "bg-mint border-mint text-ink" : ""}
                    ${feedback === "present" ? "bg-amber-300 border-amber-400 text-ink" : ""}
                    ${feedback === "absent" ? "bg-ink/15 border-ink/20 text-ink/50" : ""}
                    ${!feedback ? "border-ink/20 bg-white/80 text-ink" : ""}
                    ${isCurrent ? "ring-2 ring-accent ring-offset-1" : ""}
                  `}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Invalid word message */}
      {invalidMessage && (
        <p className="text-sm font-medium text-accent">{invalidMessage}</p>
      )}

      {/* Result message */}
      {status === "won" && (
        <p className="text-lg font-semibold text-mint">Well done!</p>
      )}
      {status === "lost" && (
        <div className="text-center">
          <p className="text-lg font-semibold text-accent">Game over</p>
          <p className="text-sm text-ink/70 mt-1">The word was: <span className="font-mono font-bold">{target}</span></p>
        </div>
      )}

      {/* Keyboard */}
      <div className="flex flex-col gap-1.5 mt-2">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1 justify-center">
            {ri === 2 && (
              <button
                type="button"
                onClick={() => handleKey("enter")}
                className="h-10 px-3 text-xs font-medium rounded bg-ink/10 text-ink hover:bg-ink/20"
              >
                Enter
              </button>
            )}
            {row.split("").map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                disabled={status !== "playing"}
                className={`
                  h-10 w-8 sm:w-9 text-sm font-medium rounded
                  ${keyStatus[key] === "correct" ? "bg-mint text-ink" : ""}
                  ${keyStatus[key] === "present" ? "bg-amber-300 text-ink" : ""}
                  ${keyStatus[key] === "absent" ? "bg-ink/20 text-ink/50" : ""}
                  ${!keyStatus[key] ? "bg-ink/10 text-ink hover:bg-ink/20" : ""}
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              >
                {key}
              </button>
            ))}
            {ri === 2 && (
              <button
                type="button"
                onClick={() => handleKey("backspace")}
                className="h-10 px-3 text-xs font-medium rounded bg-ink/10 text-ink hover:bg-ink/20"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
