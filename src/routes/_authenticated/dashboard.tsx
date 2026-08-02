import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, UserPlus, Building2, HeartHandshake, LogOut, LayoutDashboard, ArrowRight, Users2 } from "lucide-react";
import { AppLayout, Card, StatCard, PageWrapper, Button, Badge } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});


interface GroupTally {
  id: string;
  name: string;
  emoji: string | null;
  colour: string | null;
  count: number;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ members: 0, pending: 0, cellGroups: 0, branches: 0 });
  const [schemeName, setSchemeName] = useState<string>("");
  const [groupTally, setGroupTally] = useState<GroupTally[]>([]);

  const roles = user?.roles ?? [];
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));

  useEffect(() => {
    if (!isStaff) return;
    void (async () => {

      const [m, p, c, b] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("member_registrations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("cell_groups").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        members: m.count ?? 0,
        pending: p.count ?? 0,
        cellGroups: c.count ?? 0,
        branches: b.count ?? 0,
      });

      // Family groups widget
      const { data: sch } = await supabase.from("family_grouping_schemes").select("id, name").eq("is_active", true).maybeSingle();
      const scheme = sch as { id: string; name: string } | null;
      if (scheme) {
        setSchemeName(scheme.name);
        const { data: grps } = await supabase
          .from("family_groups")
          .select("id, name, emoji, colour, sequence_order")
          .eq("scheme_id", scheme.id)
          .eq("is_active", true)
          .order("sequence_order", { ascending: true, nullsFirst: false });
        const { data: assigns } = await supabase
          .from("member_family_groups")
          .select("group_id")
          .eq("scheme_id", scheme.id)
          .eq("is_active", true);
        const counts: Record<string, number> = {};
        ((assigns ?? []) as { group_id: string }[]).forEach((r) => {
          counts[r.group_id] = (counts[r.group_id] ?? 0) + 1;
        });
        setGroupTally(((grps ?? []) as Omit<GroupTally, "count">[]).map((g) => ({ ...g, count: counts[g.id] ?? 0 })));
      }
    })();
  }, [isStaff]);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/auth" });
  };

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#080c16" }}>
        <div className="max-w-md w-full text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-white">Your dashboard is under development</h1>
          <p className="mt-2 text-sm text-slate-400">
            We&apos;re still building the member dashboard. Please check back soon.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      title="Dashboard"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ...(isStaff ? [{ label: "Members", href: "/members", icon: Users }] : []),
      ]}

      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: handleLogout,
      }}
    >
      <PageWrapper>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome{user?.profile?.full_name ? `, ${user.profile.full_name}` : ""}
            </h1>
            <p className="text-sm text-slate-400 mt-1">Here's a snapshot of your church community.</p>
          </div>
          <Button variant="secondary" onClick={handleLogout}><LogOut size={16} /> Sign out</Button>
        </div>

        {!isStaff && (
          <Card title="Your account" subtitle="Member access">
            <p className="text-sm text-slate-400">
              You&apos;re signed in as a member. Church-wide records and administration tools are
              only available to church staff.
            </p>
          </Card>
        )}

        {isStaff && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Members" value={stats.members} icon={<Users size={20} />} />
            <StatCard label="Pending Registrations" value={stats.pending} icon={<UserPlus size={20} />} glowColor="amber" />
            <StatCard label="House Fellowship Centres" value={stats.cellGroups} icon={<HeartHandshake size={20} />} glowColor="green" />
            <StatCard label="Branches" value={stats.branches} icon={<Building2 size={20} />} />
          </div>
        )}

        {isStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <Card
            title="Family Groups"
            subtitle={schemeName ? `Active: ${schemeName}` : "No active scheme"}
          >
            {groupTally.length === 0 ? (
              <p className="text-sm text-slate-500">No family group assignments yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {groupTally.slice(0, 4).map((g) => (
                    <span key={g.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${g.colour ?? "#6366f1"}26`,
                        borderColor: `${g.colour ?? "#6366f1"}66`,
                        color: g.colour ?? "#6366f1",
                      }}>
                      {g.emoji && <span>{g.emoji}</span>}
                      <span>{g.name}</span>
                      <Badge>{g.count}</Badge>
                    </span>
                  ))}
                  {groupTally.length > 4 && (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                      +{groupTally.length - 4} more
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => navigate({ to: "/admin/family-groups" })}
                    className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
                  >
                    Manage Groups <ArrowRight size={12} />
                  </button>
                )}
              </>
            )}
          </Card>
          <Card title="Quick Actions" subtitle="Common tasks">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate({ to: "/members" })}>
                <Users size={16} /> View members
              </Button>
              {isAdmin && (
                <Button variant="secondary" onClick={() => navigate({ to: "/admin/family-groups" })}>
                  <Users2 size={16} /> Manage Family Groups
                </Button>
              )}
            </div>
          </Card>
        </div>
        )}

      </PageWrapper>
    </AppLayout>
  );
}
