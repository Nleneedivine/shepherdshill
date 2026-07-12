import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const IT_URL = "https://shills.lovable.app/";

export type ITSource = "sidebar" | "landing_navbar" | "dashboard" | "footer";

export interface ITProjectButtonProps {
  source: ITSource;
  variant?: "default" | "compact" | "icon" | "card" | "footer-link";
  collapsed?: boolean;
  className?: string;
}

async function logClick(source: ITSource) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const name = sess.session?.user.email ?? "anonymous";
    await supabase.from("system_logs" as never).insert({
      action: "it_project_click",
      performed_by_name: name,
      performed_by: sess.session?.user.id ?? null,
      details: { source },
    } as never);
  } catch {
    /* non-fatal */
  }
}

function handleClick(source: ITSource) {
  void logClick(source);
}

export function ITProjectButton({ source, variant = "default", collapsed, className }: ITProjectButtonProps) {
  const [hover, setHover] = useState(false);

  if (variant === "footer-link") {
    return (
      <a
        href={IT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleClick(source)}
        className={cn(
          "inline-flex items-center gap-2 text-sm text-[#2EAD3F] hover:text-white transition-colors",
          className,
        )}
      >
        <Code2 size={14} />
        Join the Church IT Project
        <span>→</span>
      </a>
    );
  }

  if (variant === "card") {
    return (
      <a
        href={IT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleClick(source)}
        className={cn(
          "group block rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02]",
          className,
        )}
        style={{
          background: "linear-gradient(135deg, rgba(26,122,42,0.15), rgba(45,27,142,0.15))",
          border: "1px solid",
          borderImage: "linear-gradient(135deg, #1A7A2A, #2D1B8E) 1",
          borderImageSlice: 1,
        }}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ boxShadow: "inset 0 0 40px rgba(46,173,63,0.2)" }}
        />
        <Code2 size={20} className="text-[#2EAD3F] mb-2" />
        <div className="text-white font-semibold mb-1">Join the IT Team</div>
        <div className="text-xs text-slate-400 mb-3">Help build this platform</div>
        <div className="text-xs text-[#2EAD3F] group-hover:text-white transition-colors">
          Learn More →
        </div>
        <div className="text-[10px] text-slate-600 font-mono mt-2 truncate">
          shills.lovable.app
        </div>
      </a>
    );
  }

  const isCompact = variant === "compact";
  const isIcon = variant === "icon" || (variant === "default" && collapsed);
  const sizeClass = isCompact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className={cn("relative inline-flex", className)}>
      <motion.a
        href={IT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleClick(source)}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        whileHover={{ scale: 1.03 }}
        title={isIcon ? "Join the Church IT Project" : undefined}
        className={cn(
          "it-project-btn group inline-flex items-center gap-2 rounded-xl font-semibold text-white transition-all",
          isIcon ? "p-2 justify-center" : sizeClass,
        )}
        style={{
          background: "linear-gradient(135deg, #1A7A2A, #2D1B8E)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <Code2 className="w-4 h-4 flex-shrink-0" />
        {!isIcon && <span className="whitespace-nowrap">Join IT Project</span>}
        {!isIcon && (
          <ExternalLink className="w-3 h-3 text-white/60 group-hover:text-white transition-opacity" />
        )}
      </motion.a>

      <AnimatePresence>
        {hover && !isIcon && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 text-[11px] text-white pointer-events-none z-50"
          >
            Help us build Shepherd's Hill Digital Platform
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
