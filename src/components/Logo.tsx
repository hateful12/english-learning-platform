import Image from "next/image";
import Link from "next/link";

export function Logo() {
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
              color: "#1a4fd6",
              textShadow:
                "0 1px 0 #5b8fff, 0 2px 0 #3a6ee8, 0 3px 4px rgba(0,0,100,0.35), 0 0 12px rgba(80,120,255,0.25)",
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
              color: "#d42020",
              textShadow:
                "0 1px 0 #ff6b6b, 0 2px 0 #c43030, 0 3px 4px rgba(100,0,0,0.35), 0 0 12px rgba(255,80,80,0.25)",
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
            stroke="#d42020"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M0 11 Q20 5 40 11 Q60 17 80 11 Q100 5 120 11 Q140 17 160 11"
            fill="none"
            stroke="#1a4fd6"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
    </Link>
  );
}
