import { cn } from "@/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";
export type SpinnerColor = "violet" | "white" | "green";

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

const colorMap: Record<SpinnerColor, string> = {
  violet: "border-t-violet-500",
  white: "border-t-white",
  green: "border-t-emerald-500",
};

export function Spinner({ size = "md", color = "violet", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-transparent animate-spin",
        sizeMap[size],
        colorMap[color],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
