import Image from "next/image";
import Link from "next/link";

export function Logo({ variant }: { variant?: "light" | "default" }) {
  const isLight = variant === "light";
  const blueColor = isLight ? "#5b8fff" : "#1a4fd6";
  const blueShadow = isLight
    ? "0 1px 0 #8bb3ff, 0 2px 0 #5b8fff, 0 3px 4px rgba(0,0,100,0.4), 0 0 16px rgba(100,150,255,0.5)"
    : "0 1px 0 #5b8fff, 0 2px 0 #3a6ee8, 0 3px 4px rgba(0,0,100,0.35), 0 0 12px rgba(80,120,255,0.25)";
  const redColor = isLight ? "#ff6b6b" : "#d42020";
  const redShadow = isLight
    ? "0 1px 0 #ff9999, 0 2px 0 #ff6b6b, 0 3px 4px rgba(100,0,0,0.4), 0 0 16px rgba(255,100,100,0.5)"
    : "0 1px 0 #ff6b6b, 0 2px 0 #c43030, 0 3px 4px rgba(100,0,0,0.35), 0 0 12px rgba(255,80,80,0.25)";
  const waveStroke = isLight ? "#ff6b6b" : "#d42020";
  const waveStroke2 = isLight ? "#5b8fff" : "#1a4fd6";

  return (
    <Link href="/" className="flex items-center gap-2 group select-none">
      <Image
        src="/logo.png"
        alt="senira.english"
        width={80}
        height={80}
        className="h-16 w-auto object-contain"
        priority
      />
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline">
          <span
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 800,
              fontSize: "1.75rem",
              color: blueColor,
              textShadow: blueShadow,
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
              fontSize: "1.75rem",
              color: redColor,
              textShadow: redShadow,
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            .english
          </span>
        </div>
        {/* decorative wave */}
        <svg
          viewBox="0 0 160 14"
          height="10"
          width="160"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-0.5"
        >
          <path
            d="M0 8 Q20 2 40 8 Q60 14 80 8 Q100 2 120 8 Q140 14 160 8"
            fill="none"
            stroke={waveStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M0 11 Q20 5 40 11 Q60 17 80 11 Q100 5 120 11 Q140 17 160 11"
            fill="none"
            stroke={waveStroke2}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
    </Link>
  );
}
