import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, UserPlus, Building2, HeartHandshake, LogOut, LayoutDashboard, ArrowRight, ArrowLeft,
  Users2, ShieldCheck, Home, UserCog, ScanLine, Wallet, Sparkles,
} from "lucide-react";
import { AppLayout, Card, StatCard, PageWrapper, Button, Badge, Avatar } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin as roleIsAdmin, isPastoral, satisfiesAny } from "@/lib/roles";
import { TERMS } from "@/constants/terminology";

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

interface RecentMember {
  id: string;
  first_name: string;
  last_name: string;
  member_code: string | null;
  created_at: string;
  profile_photo_url: string | null;
}

/** Static, non-clinical health score until analytics modules land. */
const HEALTH_SCORE = 78;

function HealthRing({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
        <circle cx="56" cy="56" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
        <circle
          cx="56" cy="56" r={r} stroke="url(#hg)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} transform="rotate(-90 56 56)"
        />
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <text x="56" y="62" textAnchor="middle" className="fill-white text-xl font-bold">{score}</text>
      </svg>
      <div>
        <p className="text-sm text-slate-300">Church Health Score</p>
        <p className="text-xs text-slate-500 mt-1">
          Indicative only. Live scoring arrives with attendance and giving modules.
        </p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ members: 0, pending: 0, cellGroups: 0, branches: 0, incomplete: 0 });
  const [schemeName, setSchemeName] = useState<string>("");
  const [groupTally, setGroupTally] = useState<GroupTally[]>([]);
  const [recent, setRecent] = useState<RecentMember[]>([]);
  const [myGroup, setMyGroup] = useState<{ id: string; name: string } | null>(null);
  const [myMembers, setMyMembers] = useState<RecentMember[]>([]);

  const roles = user?.roles ?? [];
  const isStaff = isPastoral(roles);
  const isAdmin = roleIsAdmin(roles);
  const isCellLeader = !isStaff && satisfiesAny(roles, ["cell_leader"]);

  useEffect(() => {
    if (!isStaff) return;
    void (async () => {
      const [m, p, c, b, inc, rec] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("member_registrations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("cell_groups").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("incomplete_profiles").select("id", { count: "exact", head: true }),
        supabase.from("members").select("id, first_name, last_name, member_code, created_at, profile_photo_url")
          .order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        members: m.count ?? 0,
        pending: p.count ?? 0,
        cellGroups: c.count ?? 0,
        branches: b.count ?? 0,
        incomplete: inc.count ?? 0,
      });
      setRecent((rec.data ?? []) as RecentMember[]);

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

  // Cell leader view data: their centre and its members
  useEffect(() => {
    if (!isCellLeader) return;
    void (async () => {
      const name = user?.profile?.full_name;
      if (!name) return;
      const { data: cg } = await supabase
        .from("cell_groups")
        .select("id, name")
        .eq("leader_name", name)
        .maybeSingle();
      const group = cg as { id: string; name: string } | null;
      if (!group) return;
      setMyGroup(group);
      const { data: mem } = await supabase
        .from("members")
        .select("id, first_name, last_name, member_code, created_at, profile_photo_url")
        .eq("cell_group_id", group.id)
        .order("first_name");
      setMyMembers((mem ?? []) as RecentMember[]);
    })();
  }, [isCellLeader, user?.profile?.full_name]);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/auth" });
  };

  if (isCellLeader) {
    return (
      <AppLayout
        title="Dashboard"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
        navItems={[{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }]}
        userProfile={{
          name: user?.profile?.full_name ?? user?.email ?? "User",
          email: user?.email ?? "",
          onLogout: handleLogout,
        }}
      >
        <PageWrapper>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">
              Welcome{user?.profile?.full_name ? `, ${user.profile.full_name}` : ""}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {myGroup ? `${TERMS.CELL_GROUP}: ${myGroup.name}` : `No ${TERMS.CELL_GROUP} is linked to your account yet.`}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Members in your centre" value={myMembers.length} icon={<Users size={20} />} />
            <StatCard label="Meetings this month" value={0} glowColor="green" />
            <StatCard label="Reports submitted" value={0} glowColor="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Your members" subtitle={myGroup?.name ?? "—"}>
              {myMembers.length === 0 ? (
                <p className="text-sm text-slate-500">No members assigned yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {myMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <Avatar name={`${m.first_name} ${m.last_name}`} src={m.profile_photo_url ?? undefined} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{m.member_code ?? "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Weekly report" subtitle="Reminder">
              <p className="text-sm text-slate-400">
                Remember to submit your {TERMS.CELL_REPORT} after each meeting. Report submission
                opens when the meetings module ships.
              </p>
              <Button className="mt-3" variant="secondary" disabled>Submit report (coming soon)</Button>
            </Card>
          </div>
        </PageWrapper>
      </AppLayout>
    );
  }

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
        { label: "Members", href: "/members", icon: Users },
        ...(isAdmin
          ? [
              { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
              { label: TERMS.CELL_GROUPS, href: "/admin/house-fellowship", icon: Home },
            ]
          : []),
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Members" value={stats.members} icon={<Users size={20} />} />
          <StatCard label="Today's Check-ins" value={0} icon={<ScanLine size={20} />} glowColor="green" />
          <StatCard label="This Month's Giving" value={0} prefix="₦" icon={<Wallet size={20} />} glowColor="amber" />
          <StatCard label="Active Care Cases" value={0} icon={<HeartHandshake size={20} />} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatCard label="Pending Registrations" value={stats.pending} icon={<UserPlus size={20} />} glowColor="amber" />
          <StatCard label={TERMS.CELL_GROUPS} value={stats.cellGroups} icon={<Home size={20} />} glowColor="green" />
          <StatCard label="Branches" value={stats.branches} icon={<Building2 size={20} />} />
          <StatCard label="Incomplete Profiles" value={stats.incomplete} icon={<UserCog size={20} />} glowColor="amber" />
        </div>

        {isAdmin && (
          <Card title="Quick Actions" subtitle="Common tasks" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Members", to: "/members", icon: Users },
                { label: "Verifications", to: "/admin/verifications", icon: ShieldCheck },
                { label: TERMS.CELL_GROUPS, to: "/admin/house-fellowship", icon: Home },
                { label: "Transfers", to: "/admin/transfers", icon: ArrowRight },
                { label: "Departments", to: "/admin/departments", icon: Building2 },
                { label: "Family Groups", to: "/admin/family-groups", icon: Users2 },
                { label: "Incomplete", to: "/admin/incomplete-profiles", icon: UserCog },
                { label: "Journey", to: "/admin/spiritual-journey", icon: Sparkles },
              ].map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-xs text-slate-300 hover:border-violet-500/40 hover:text-white transition-colors"
                >
                  <a.icon size={18} />
                  {a.label}
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <Card title="Recent Members" subtitle="Newest records">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">No members yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map((m) => (
                  <Link
                    key={m.id}
                    to="/members/$id"
                    params={{ id: m.id }}
                    className="flex items-center gap-3 py-2 hover:opacity-80"
                  >
                    <Avatar name={`${m.first_name} ${m.last_name}`} src={m.profile_photo_url ?? undefined} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-slate-500 font-mono">{m.member_code ?? "—"}</p>
                    </div>
                    <span className="text-xs text-slate-600">{new Date(m.created_at).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Verification Queue" subtitle="Awaiting review">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-white">{stats.pending}</p>
                <p className="text-xs text-slate-500 mt-1">registrations pending approval</p>
              </div>
              {isAdmin && (
                <Link to="/admin/verifications">
                  <Button variant="secondary" size="sm">Review <ArrowRight size={14} /></Button>
                </Link>
              )}
            </div>
          </Card>

          <Card title="Church Health" subtitle="Overview">
            <HealthRing score={HEALTH_SCORE} />
          </Card>

          <Card title="Family Groups" subtitle={schemeName ? `Active: ${schemeName}` : "No active scheme"}>
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
                  <Link to="/admin/family-groups" className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1">
                    Manage Groups <ArrowRight size={12} />
                  </Link>
                )}
              </>
            )}
          </Card>
        </div>
      </PageWrapper>
    </AppLayout>
  );
}
