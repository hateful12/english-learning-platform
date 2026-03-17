"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/dashboard", label: "Lessons" },
  { href: "/teacher/dashboard", label: "Resources", flag: true },
  { href: "/teacher/dashboard", label: "Messages" },
] as const;

function UnionJackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 30"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <clipPath id="s">
        <path d="M0,0 v30 h60 v-30 z v15 h60 v15 h-60 v15 h60 v15 h-60 z" />
      </clipPath>
      <clipPath id="t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function TeacherHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-ink/5 overflow-hidden">
      {/* Skyline background - clean white with subtle light blue skyline */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.5) 60%, rgba(230,240,255,0.4) 100%), url(/london-skyline-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="relative z-10">
        {/* Top section: avatar, logo, buttons */}
        <div className="flex items-center justify-between px-6 py-4 md:px-8 min-h-[100px]">
          <div className="flex items-center gap-4">
            {/* Avatar placeholder */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-ink/10 flex items-center justify-center overflow-hidden border-2 border-white/80 shadow-sm">
              <svg
                className="w-6 h-6 text-ink/40"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            {/* Logo + TEACHER badge */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group select-none">
                <div className="flex flex-col leading-none">
                  <div className="flex items-baseline gap-0.5">
                    <span
                      style={{
                        fontFamily: "'Lora', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 800,
                        fontSize: "1.5rem",
                        color: "#1a4fd6",
                        letterSpacing: "-0.01em",
                        lineHeight: 1,
                      }}
                    >
                      senira
                    </span>
                    <span
                      style={{
                        fontFamily: "'Lora', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 800,
                        fontSize: "1.5rem",
                        color: "#d42020",
                        letterSpacing: "-0.01em",
                        lineHeight: 1,
                      }}
                    >
                      .english
                    </span>
                  </div>
                  {/* Wave underline - red and blue */}
                  <svg viewBox="0 0 120 10" height="8" width="120" className="mt-0.5">
                    <path
                      d="M0 5 Q15 1 30 5 Q45 9 60 5 Q75 1 90 5 Q105 9 120 5"
                      fill="none"
                      stroke="#d42020"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0 7 Q15 3 30 7 Q45 11 60 7 Q75 3 90 7 Q105 11 120 7"
                      fill="none"
                      stroke="#1a4fd6"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.8"
                    />
                  </svg>
                </div>
              </Link>
              <span className="hidden sm:inline-flex items-center rounded-full border-2 border-[#d42020] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#d42020] tracking-wide uppercase">
                TEACHER
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              View as student
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Red/blue divider */}
        <div className="h-1 flex flex-col">
          <div className="h-[3px] bg-[#d42020]" />
          <div className="h-[2px] bg-[#1a4fd6]" />
        </div>

        {/* Navigation bar */}
        <nav className="flex items-center px-6 md:px-8 bg-white/95">
          {NAV_ITEMS.map((item, i) => {
            const isActive = item.label === "Dashboard" && pathname === "/teacher/dashboard";
            return (
              <div key={item.label} className="flex items-center">
                {i > 0 && (
                  <div className="w-px h-4 bg-ink/20 mx-1" aria-hidden />
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-ink border-b-2 border-[#d42020] -mb-[2px]"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {item.flag && (
                    <UnionJackIcon className="w-4 h-2.5 flex-shrink-0" />
                  )}
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
