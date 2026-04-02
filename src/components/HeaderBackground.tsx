import Image from "next/image";

export function HeaderBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <Image
        src="/header-london-skyline.png"
        alt=""
        fill
        className="object-cover object-bottom"
        priority
        sizes="100vw"
      />
    </div>
  );
}
