import { useEffect, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, type CardGlow } from "./Card";

export interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  prefix?: string;
  trend?: number;
  trendLabel?: string;
  icon?: ReactNode;
  glowColor?: CardGlow;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  prefix,
  trend,
  trendLabel,
  icon,
  glowColor = "purple",
  className,
}: StatCardProps) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [value, mv]);

  const trendUp = (trend ?? 0) >= 0;

  return (
    <Card glow={glowColor} className={cn("relative", className)}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && (
          <div className="text-violet-400 opacity-80">{icon}</div>
        )}
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        {prefix && <span className="text-2xl font-semibold text-slate-300">{prefix}</span>}
        <motion.span className="text-4xl font-bold text-white tracking-tight">
          {rounded}
        </motion.span>
        {unit && <span className="text-lg text-slate-400 ml-1">{unit}</span>}
      </div>

      {typeof trend === "number" && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trendUp
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400",
            )}
          >
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </Card>
  );
}
