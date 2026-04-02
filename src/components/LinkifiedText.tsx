import { Fragment } from "react";

/** http(s) URLs — split keeps delimiters when regex uses a capture group */
const URL_SPLIT = /(https?:\/\/[^\s<>"']+)/gi;

function isHttpUrl(part: string): boolean {
  return /^https?:\/\//i.test(part);
}

export function LinkifiedText({
  text,
  className,
  as: Wrapper = "p",
}: {
  text: string;
  className?: string;
  as?: "p" | "div" | "span";
}) {
  const parts = text.split(URL_SPLIT);
  const content = parts.map((part, i) =>
    isHttpUrl(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent underline decoration-accent/50 underline-offset-2 break-words hover:opacity-90"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );

  if (Wrapper === "span") {
    return <span className={className}>{content}</span>;
  }
  if (Wrapper === "div") {
    return <div className={className}>{content}</div>;
  }
  return <p className={className}>{content}</p>;
}
