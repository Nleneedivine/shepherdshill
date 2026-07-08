import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  children?: ReactNode;
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
  warning: { bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
  danger: { bg: "bg-rose-500/20", text: "text-rose-400", dot: "bg-rose-400" },
  info: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-400" },
  purple: { bg: "bg-violet-500/20", text: "text-violet-400", dot: "bg-violet-400" },
  neutral: { bg: "bg-slate-500/20", text: "text-slate-300", dot: "bg-slate-300" },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  dot,
  className,
  children,
}: BadgeProps) {
  const v = variantClasses[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        v.bg,
        v.text,
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span className={cn("relative flex h-1.5 w-1.5")}>
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              v.dot,
            )}
          />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", v.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
