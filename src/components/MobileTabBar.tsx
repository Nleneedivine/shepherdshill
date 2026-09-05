import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UserPlus, Heart, Mic2, LogIn, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-style persistent bottom tab bar (mobile only).
 * Visual inspiration: restrained dark app chrome. No social/streak/badge features.
 */
export function MobileTabBar({ isAuthed }: { isAuthed: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/register", label: "Register", icon: UserPlus },
    { to: "/give", label: "Give", icon: Heart },
    { to: "/sermons", label: "Sermons", icon: Mic2 },
    isAuthed
      ? { to: "/dashboard", label: "You", icon: CircleUser }
      : { to: "/auth", label: "Sign In", icon: LogIn },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-[#0A0E19]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = path === t.to;
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-subtle",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
