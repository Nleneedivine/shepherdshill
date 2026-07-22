import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ITProjectButtonProps {
  source?: string;
  variant?: "icon" | "default";
  collapsed?: boolean;
  className?: string;
}

export function ITProjectButton({
  source = "sidebar",
  variant = "default",
  collapsed = false,
  className,
}: ITProjectButtonProps) {
  return (
    <button
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 text-white font-medium transition-all hover:opacity-90",
        collapsed || variant === "icon" ? "p-2" : "px-4 py-2.5 text-sm",
        className
      )}
      title={collapsed || variant === "icon" ? "IT Project" : undefined}
    >
      <Wrench size={16} />
      {!collapsed && variant !== "icon" && <span>IT Project</span>}
    </button>
  );
}