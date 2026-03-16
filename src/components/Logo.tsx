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
        <span
          className="font-serif font-bold tracking-tight text-[1.45rem] text-[#1a3a8f] group-hover:opacity-90 transition-opacity"
          style={{ letterSpacing: "-0.01em" }}
        >
          senira
        </span>
        <span
          className="font-serif font-bold tracking-tight text-[1.45rem] text-[#cc1f1f] group-hover:opacity-90 transition-opacity"
          style={{ letterSpacing: "-0.01em" }}
        >
          .english
        </span>
      </div>
    </Link>
  );
}
