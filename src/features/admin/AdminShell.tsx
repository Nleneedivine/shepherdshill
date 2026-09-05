import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Home,
  Building2,
  Boxes,
  ArrowLeftRight,
  UserCog,
  GitBranch,
  Sparkles,
  FileText,
  Mic2,
} from "lucide-react";
import { AppLayout, PageWrapper } from "@/components/ds";
import { useAuth } from "@/hooks/useAuth";
import { TERMS } from "@/constants/terminology";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
  { label: "Departments", href: "/admin/departments", icon: Boxes },
  { label: TERMS.CELL_GROUPS, href: "/admin/house-fellowship", icon: Home },
  { label: "Family Groups", href: "/admin/family-groups", icon: Building2 },
  { label: "Transfers", href: "/admin/transfers", icon: ArrowLeftRight },
  { label: "Incomplete Profiles", href: "/admin/incomplete-profiles", icon: UserCog },
  { label: "Membership Stages", href: "/admin/membership-stages", icon: GitBranch },
  { label: "Spiritual Journey", href: "/admin/spiritual-journey", icon: Sparkles },
  { label: "Sermons", href: "/admin/sermons", icon: Mic2 },
  { label: "Drafts", href: "/admin/drafts", icon: FileText },
];

export interface AdminShellProps {
  children: ReactNode;
  title: string;
  description?: string;
  crumb: string;
  actions?: ReactNode;
}

/** Shared chrome for every /admin page: sidebar nav, breadcrumb and page header. */
export function AdminShell({ children, title, description, crumb, actions }: AdminShellProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppLayout
      title={title}
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Admin" }, { label: crumb }]}
      navItems={NAV.map((n) => ({ ...n, active: pathname.startsWith(n.href) }))}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => {
          await logout();
          void navigate({ to: "/auth" });
        },
      }}
    >
      <PageWrapper>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </PageWrapper>
    </AppLayout>
  );
}
