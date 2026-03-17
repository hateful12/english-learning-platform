"use client";

import { useEffect, useState } from "react";
import { WordleGame } from "./WordleGame";

type LeaderboardEntry = {
  studentId: string;
  name: string;
  email: string;
  wins: number;
  played: number;
  streak: number;
  distribution: number[];
};

function HowToPlay({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-ink sm:cursor-default sm:pointer-events-none"
      >
        <span>How to play</span>
        <span className="sm:hidden">{collapsed ? "▼" : "▲"}</span>
      </button>
      <div className={`border-t border-ink/10 px-4 py-3 text-sm text-ink/80 space-y-2 ${collapsed ? "hidden sm:block" : "block"}`}>
          <p>Guess the 5-letter word in 6 tries.</p>
          <p>
            <span className="inline-block w-6 h-6 rounded border-2 border-mint bg-mint text-center text-xs font-bold text-ink leading-6">G</span>
            {" "}Green = correct letter, correct spot
          </p>
          <p>
            <span className="inline-block w-6 h-6 rounded border-2 border-amber-400 bg-amber-300 text-center text-xs font-bold text-ink leading-6">Y</span>
            {" "}Yellow = letter in word, wrong spot
          </p>
          <p>
            <span className="inline-block w-6 h-6 rounded border border-ink/20 bg-ink/15 text-center text-xs font-bold text-ink/50 leading-6">G</span>
            {" "}Gray = letter not in word
          </p>
        </div>
    </div>
  );
}

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] overflow-hidden">
      <h3 className="px-4 py-3 font-medium text-ink border-b border-ink/10">Leaderboard</h3>
      <div className="max-h-48 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink/50">No games played yet.</p>
        ) : (
          <ol className="divide-y divide-ink/5">
            {entries.slice(0, 10).map((e, i) => (
              <li key={e.studentId} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-ink/60 font-mono w-5">{i + 1}.</span>
                <span className="truncate flex-1 mx-1">{e.name || e.email}</span>
                <span className="text-mint font-medium shrink-0">{e.wins}W</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function PersonalStats({ entry }: { entry: LeaderboardEntry | null }) {
  if (!entry) return null;
  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] overflow-hidden">
      <h3 className="px-4 py-3 font-medium text-ink border-b border-ink/10">Your stats</h3>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-ink/60">Streak</span>
          <span className="font-medium text-mint">{entry.streak}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/60">Wins</span>
          <span className="font-medium">{entry.wins}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/60">Played</span>
          <span className="font-medium">{entry.played}</span>
        </div>
        {entry.wins > 0 && (
          <div className="pt-2 border-t border-ink/10">
            <p className="text-xs text-ink/50 mb-1">Guess distribution</p>
            <div className="flex gap-1">
              {entry.distribution.slice(0, 6).map((n, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="text-[10px] text-ink/40">{i + 1}</div>
                  <div className="h-6 flex items-end justify-center">
                    <div
                      className="w-full max-w-4 bg-mint/60 rounded-t min-h-[4px]"
                      style={{ height: `${Math.max(4, (n / Math.max(1, Math.max(...entry.distribution))) * 20)}px` }}
                    />
                  </div>
                  <div className="text-[10px] font-medium">{n}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WordleTab({ studentId }: { studentId: string | null }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [instructionsOpen, setInstructionsOpen] = useState(true);

  useEffect(() => {
    fetch("/api/wordle/leaderboard")
      .then((r) => r.json())
      .then((data) => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]));
  }, []);

  const myStats = studentId ? leaderboard.find((e) => e.studentId === studentId) ?? null : null;

  async function handleGameEnd(date: string, result: "won" | "lost", tries: number) {
    await fetch("/api/wordle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, result, tries }),
    });
    const res = await fetch("/api/wordle/leaderboard");
    const data = await res.json();
    setLeaderboard(Array.isArray(data) ? data : []);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Leaderboard + Stats */}
      <div className="lg:w-56 shrink-0 space-y-4 order-2 lg:order-1">
        <LeaderboardSection entries={leaderboard} />
        <PersonalStats entry={myStats} />
      </div>

      {/* Center: Wordle */}
      <div className="flex-1 min-w-0 order-1 lg:order-2">
        <div className="card p-6">
          <WordleGame onGameEnd={handleGameEnd} />
        </div>
      </div>

      {/* Right: Instructions */}
      <div className="lg:w-56 shrink-0 order-3">
        <div className="lg:sticky lg:top-4">
          <HowToPlay collapsed={!instructionsOpen} onToggle={() => setInstructionsOpen((o) => !o)} />
        </div>
      </div>
    </div>
  );
}
