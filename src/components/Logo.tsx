import Image from "next/image";
import Link from "next/link";

export function Logo({ variant }: { variant?: "light" | "default" }) {
  const isLight = variant === "light";
  const textGradient = isLight
    ? "linear-gradient(90deg, #f0d4e0 0%, #f5dde8 35%, #fae8ef 70%, #fff5f8 100%)"
    : "linear-gradient(90deg, #5a3d4a 0%, #6a4a58 28%, #9a6f82 52%, #d4a8b8 85%, #deb8c4 100%)";
  const swooshMain = isLight ? "#c49bab" : "#684252";
  const swooshAccent = isLight ? "#c4a8cf" : "#957aa8";
  const starFill = isLight ? "#b888c8" : "#7a5694";
  const dotFill = isLight ? "#a890c0" : "#8b6aa0";

  return (
    <Link href="/" className="flex items-center gap-2 group select-none">
      <Image
        src="/logo.png"
        alt=""
        width={80}
        height={80}
        className="h-16 w-auto object-contain"
        priority
      />
      <div className="flex w-fit flex-col leading-none">
        <span
          className="lowercase"
          style={{
            fontFamily: "'Lora', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "1.75rem",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            backgroundImage: textGradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          senira.english
        </span>
        <svg
          viewBox="0 0 200 26"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-1 h-[1.05rem] w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            d="M 4 11 C 22 22 58 20 92 12 C 118 6 138 8 148 12"
            fill="none"
            stroke={swooshMain}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M 132 12 C 152 4 176 2 196 5"
            fill="none"
            stroke={swooshAccent}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={0.92}
          />
          <path
            d="M 162 8.2 L 163.45 11.25 L 166.7 11.7 L 164.35 13.95 L 164.9 17.2 L 162 15.55 L 159.1 17.2 L 159.65 13.95 L 157.3 11.7 L 160.55 11.25 Z"
            fill={starFill}
          />
          <circle cx="197.5" cy="5.2" r="1.35" fill={dotFill} />
        </svg>
      </div>
    </Link>
  );
}
