import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, LayoutGrid, LayoutList, ShieldCheck, UserPlus, Users, LayoutDashboard, AlertTriangle, Fingerprint, CalendarPlus } from "lucide-react";
import { AppLayout, PageWrapper, StatCard, Button, Spinner, EmptyState, Badge } from "@/components/ds";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";
import {
  useMembers, fetchMemberStats, fetchFilterOptions, MEMBERS_PAGE_SIZE,
  type MemberFilterState, type MemberStats,
} from "./useMembers";
import { MemberFilters } from "./MemberFilters";
import { MembersTable } from "./MembersTable";
import { MembersGrid } from "./MembersGrid";

const DEFAULT_FILTERS: MemberFilterState = {
  q: "", stage: "all", dept: "all", cell: "all", status: "active", bio: "all",
  view: "table", page: 0, sort: "created_at", dir: "desc",
};

function readInitialFromUrl(): MemberFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const p = new URLSearchParams(window.location.search);
  return {
    q: p.get("q") ?? "",
    stage: p.get("stage") ?? "all",
    dept: p.get("dept") ?? "all",
    cell: p.get("cell") ?? "all",
    status: p.get("status") ?? "active",
    bio: p.get("bio") ?? "all",
    view: (p.get("view") === "grid" ? "grid" : "table"),
    page: Number(p.get("page") ?? "0") || 0,
    sort: ((p.get("sort") as MemberFilterState["sort"]) ?? "created_at"),
    dir: ((p.get("dir") as MemberFilterState["dir"]) ?? "desc"),
  };
}

function writeUrl(f: MemberFilterState) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.stage !== "all") p.set("stage", f.stage);
  if (f.dept !== "all") p.set("dept", f.dept);
  if (f.cell !== "all") p.set("cell", f.cell);
  if (f.status !== "active") p.set("status", f.status);
  if (f.bio !== "all") p.set("bio", f.bio);
  if (f.view !== "table") p.set("view", f.view);
  if (f.page > 0) p.set("page", String(f.page));
  if (f.sort !== "created_at") p.set("sort", f.sort);
  if (f.dir !== "desc") p.set("dir", f.dir);
  const s = p.toString();
  const url = s ? `${window.location.pathname}?${s}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function MembersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToastContext();

  const [filters, setFilters] = useState<MemberFilterState>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [stats, setStats] = useState<MemberStats>({ total: 0, newThisMonth: 0, withBiometrics: 0, incompleteProfiles: 0 });
  const [options, setOptions] = useState<{ stages: string[]; departments: { id: string; name: string }[]; cellGroups: { id: string; name: string }[] }>({
    stages: [], departments: [], cellGroups: [],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = readInitialFromUrl();
    setFilters(init);
    setSearchInput(init.q);
  }, []);

  useEffect(() => { writeUrl(filters); }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput, page: 0 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const [s, o] = await Promise.all([fetchMemberStats(), fetchFilterOptions()]);
      setStats(s); setOptions(o);
    })();
  }, []);

  const { items, total, loading, error, refresh } = useMembers(filters);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE)), [total]);

  const patch = (p: Partial<MemberFilterState>) => setFilters((f) => ({ ...f, ...p, page: p.page ?? 0 }));
  const clearFilters = () => { setSearchInput(""); setFilters({ ...DEFAULT_FILTERS, view: filters.view }); };

  const handleSort = (col: MemberFilterState["sort"]) => {
    setFilters((f) => ({ ...f, sort: col, dir: f.sort === col && f.dir === "desc" ? "asc" : "desc", page: 0 }));
  };

  const toggle = (id: string, v: boolean) => setSelected((prev) => {
    const n = new Set(prev); if (v) n.add(id); else n.delete(id); return n;
  });
  const toggleAll = (v: boolean) => setSelected(v ? new Set(items.map((m) => m.id)) : new Set());

  const exportSelected = () => {
    const rows = items.filter((m) => selected.has(m.id));
    if (!rows.length) return showToast("Select members to export", "info");
    const header = ["member_code", "first_name", "last_name", "phone_primary", "email", "membership_stage", "cell_group", "status", "created_at"];
    const csv = [
      header.join(","),
      ...rows.map((r) => [
        r.member_code ?? "", r.first_name, r.last_name, r.phone_primary ?? "", r.email ?? "",
        r.membership_stage ?? "", r.cell_group_name ?? "", r.membership_status, r.created_at,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `members-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} member(s)`, "success");
  };

  return (
    <AppLayout
      title="Members"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Members" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users, active: true },
        { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => { await logout(); navigate({ to: "/auth" }); },
      }}
    >
      <PageWrapper>
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Members <Badge variant="purple">{stats.total}</Badge>
            </h1>
            <p className="text-sm text-slate-400 mt-1">All members in your branch</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportSelected}><Download size={16} /> Export</Button>
            <Button variant="primary" onClick={() => navigate({ to: "/register" })}>
              <UserPlus size={16} /> Add Member
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total members" value={stats.total} icon={<Users size={20} />} />
          <StatCard label="New this month" value={stats.newThisMonth} icon={<CalendarPlus size={20} />} glowColor="green" />
          <StatCard label="With biometrics" value={stats.withBiometrics} icon={<Fingerprint size={20} />} />
          <StatCard label="Incomplete profiles" value={stats.incompleteProfiles} icon={<AlertTriangle size={20} />} glowColor="amber" />
        </div>

        <MemberFilters
          filters={filters}
          onChange={patch}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          options={options}
          onClear={clearFilters}
        />

        <div className="flex justify-end mb-3 gap-1">
          <button
            className={`p-2 rounded-lg border ${filters.view === "table" ? "border-violet-500 text-violet-300" : "border-white/10 text-slate-400 hover:text-white"}`}
            onClick={() => setFilters((f) => ({ ...f, view: "table" }))}
            aria-label="Table view"
          ><LayoutList size={16} /></button>
          <button
            className={`p-2 rounded-lg border ${filters.view === "grid" ? "border-violet-500 text-violet-300" : "border-white/10 text-slate-400 hover:text-white"}`}
            onClick={() => setFilters((f) => ({ ...f, view: "grid" }))}
            aria-label="Grid view"
          ><LayoutGrid size={16} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users size={40} className="text-slate-400" />}
            title="No members found"
            description="Adjust your filters or add a new member"
            actionLabel="Add Member"
            action={() => navigate({ to: "/register" })}
          />
        ) : filters.view === "grid" ? (
          <MembersGrid items={items} selected={selected} onToggle={toggle} />
        ) : (
          <MembersTable
            items={items}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            sort={filters.sort}
            dir={filters.dir}
            onSort={handleSort}
          />
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between pt-4 text-sm text-slate-400">
            <span>Page {filters.page + 1} of {totalPages} — {total} members</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={filters.page === 0} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Prev</Button>
              <Button size="sm" variant="secondary" disabled={filters.page + 1 >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</Button>
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
            <span className="text-sm text-white">{selected.size} selected</span>
            <Button size="sm" variant="secondary" onClick={() => showToast("Bulk messaging arrives in Sprint 2", "info")}>Send Message</Button>
            <Button size="sm" variant="secondary" onClick={exportSelected}>Export Selected</Button>
            <Button size="sm" variant="secondary" onClick={() => showToast("House Fellowship Centre assignment arrives in Sprint 1B", "info")}>Assign to Centre</Button>
            <Button size="sm" variant="secondary" onClick={() => showToast("Stage change arrives in Sprint 1B", "info")}>Change Stage</Button>
            <Button size="sm" variant="danger" onClick={() => { void refresh(); showToast("Deactivation arrives in Sprint 1B", "info"); }}>Deactivate</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </PageWrapper>
    </AppLayout>
  );
}
