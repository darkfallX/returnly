import { cn } from "@/lib/utils";

interface AnimatedHeadingProps {
  text: string;
  highlightWords?: string[];
  className?: string;
  as?: "h1" | "h2" | "h3";
}

// Keep the shared call-site contract; ordinary headings render immediately.
export function AnimatedHeading({
  text,
  className,
  as: Tag = "h1",
}: AnimatedHeadingProps) {
  return (
    <Tag
      className={cn(
        "font-semibold tracking-[-0.035em] text-[#18181B] leading-tight",
        className,
      )}
    >
      {text}
    </Tag>
  );
}
