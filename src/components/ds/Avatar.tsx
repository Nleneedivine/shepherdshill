import { useState } from "react";
import { cn } from "@/lib/utils";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

const sizeMap: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  sm: { box: "h-8 w-8", text: "text-xs", dot: "h-2 w-2" },
  md: { box: "h-10 w-10", text: "text-sm", dot: "h-2.5 w-2.5" },
  lg: { box: "h-14 w-14", text: "text-base", dot: "h-3 w-3" },
  xl: { box: "h-20 w-20", text: "text-xl", dot: "h-3.5 w-3.5" },
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ src, name, size = "md", online, className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const s = sizeMap[size];
  const showImage = src && !errored;

  return (
    <div className={cn("relative inline-flex flex-shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-semibold text-white",
          s.box,
          s.text,
          !showImage && "bg-gradient-to-br from-violet-600 to-blue-500",
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={name || "avatar"}
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </div>
      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-[#080c16]",
            s.dot,
          )}
        >
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
        </span>
      )}
    </div>
  );
}
