import type { ReactNode } from "react";
import { Bell, Menu, Mic, Search } from "lucide-react";
import { Avatar } from "./Avatar";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface TopNavProps {
  title?: string;
  breadcrumb?: Breadcrumb[];
  onMenuClick?: () => void;
  notificationCount?: number;
  userName?: string;
  userAvatar?: string;
  right?: ReactNode;
}

export function TopNav({
  title,
  breadcrumb,
  onMenuClick,
  notificationCount = 0,
  userName,
  userAvatar,
  right,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            {title && (
              <h1 className="text-base md:text-lg font-semibold text-white truncate">{title}</h1>
            )}
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="hidden md:flex items-center gap-1 text-xs text-slate-500">
                {breadcrumb.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-600">/</span>}
                    {b.href ? (
                      <a href={b.href} className="hover:text-slate-300 transition-colors">
                        {b.label}
                      </a>
                    ) : (
                      <span>{b.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {right}
          <IconBtn label="Search"><Search size={18} /></IconBtn>
          <IconBtn label="Notifications">
            <div className="relative">
              <Bell size={18} />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] font-semibold text-white flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </div>
          </IconBtn>
          <IconBtn label="Voice command">
            <Mic size={18} />
          </IconBtn>
          <Avatar name={userName} src={userAvatar} size="sm" />
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      {children}
    </button>
  );
}
