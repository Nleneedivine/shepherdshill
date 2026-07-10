import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckCircle2, Filter, LayoutDashboard, Search, ShieldCheck, Users, XCircle } from "lucide-react";
import { AppLayout, PageWrapper, StatCard, Card, Input, Select, EmptyState, Button, Spinner } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SubmissionCard } from "@/features/admin/SubmissionCard";
import { ReviewPanel } from "@/features/admin/ReviewPanel";
import { RejectModal } from "@/features/admin/RejectModal";
import { approveSubmission } from "@/lib/approveSubmission";
import type { Submission } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/verifications")({
  ssr: false,
  component: VerificationsPage,
});

const PAGE_SIZE = 20;

function VerificationsPage() {
  const { user, logout } = useAuth();
  const { showToast } = useToastContext();

  const [stats, setStats] = useState({ pending: 0, aiCleared: 0, flagged: 0, approvedToday: 0 });
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [p, a, f, ap] = await Promise.all([
      supabase.from("member_registrations").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      supabase.from("member_registrations").select("id", { count: "exact", head: true }).eq("verification_status", "ai_cleared"),
      supabase.from("member_registrations").select("id", { count: "exact", head: true }).in("verification_status", ["flagged", "held"]),
      supabase.from("member_registrations").select("id", { count: "exact", head: true })
        .eq("verification_status", "approved").gte("verified_at", today.toISOString()),
    ]);
    setStats({
      pending: p.count ?? 0,
      aiCleared: a.count ?? 0,
      flagged: f.count ?? 0,
      approvedToday: ap.count ?? 0,
    });
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("member_registrations")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (statusFilter !== "all") q = q.eq("verification_status", statusFilter);
    if (methodFilter !== "all") q = q.eq("submission_method", methodFilter);
    if (fromDate) q = q.gte("submitted_at", new Date(fromDate).toISOString());
    if (toDate) {
      const end = new Date(toDate); end.setHours(23, 59, 59, 999);
      q = q.lte("submitted_at", end.toISOString());
    }
    if (debounced) {
      const s = debounced.replace(/[,%]/g, "");
      q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone_primary.ilike.%${s}%`);
    }
    const { data, error, count } = await q;
    if (!error) {
      setItems((data ?? []) as unknown as Submission[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, statusFilter, methodFilter, fromDate, toDate, debounced]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);
  useEffect(() => { void fetchList(); }, [fetchList]);

  // Realtime: prepend new submissions
  useEffect(() => {
    const channel = supabase
      .channel("member_registrations_admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "member_registrations" }, (payload) => {
        setItems((prev) => [payload.new as unknown as Submission, ...prev]);
        void fetchStats();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchStats]);

  const handleApprove = async (s: Submission, edited?: Record<string, unknown>) => {
    setApprovingIds((prev) => new Set(prev).add(s.id));
    const prevItems = items;
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    const res = await approveSubmission({ submissionId: s.id, editedData: edited });
    setApprovingIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
    if (res.success) {
      showToast(`Member approved — ${s.first_name ?? ""} ${s.last_name ?? ""} is now in the system`, "success");
      setReviewing(null);
      void fetchStats();
    } else {
      setItems(prevItems);
      showToast(res.error ?? "Approval failed", "error");
    }
  };

  const handleReject = async (s: Submission, reason: string) => {
    const { error } = await supabase
      .from("member_registrations")
      .update({ verification_status: "rejected", rejection_reason: reason, verified_at: new Date().toISOString() } as never)
      .eq("id", s.id);
    if (error) return showToast(error.message, "error");
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    setReviewing(null);
    void fetchStats();
    showToast("Submission rejected", "success");
  };

  const selectedList = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const canBulkApprove = selectedList.length > 0 && selectedList.every((s) => s.verification_status === "ai_cleared");

  const handleBulkApprove = async () => {
    for (const s of selectedList) await handleApprove(s);
    setSelected(new Set());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout
      title="Verifications"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Verifications" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
        { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck, active: true },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: () => void logout(),
      }}
    >
      <PageWrapper>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Member Verification Queue</h1>
          <p className="text-sm text-slate-400 mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pending" value={stats.pending} icon={<Filter size={20} />} glowColor="amber" />
          <StatCard label="AI Cleared" value={stats.aiCleared} icon={<ShieldCheck size={20} />} />
          <StatCard label="Flagged" value={stats.flagged} icon={<XCircle size={20} />} glowColor="rose" />
          <StatCard label="Approved Today" value={stats.approvedToday} icon={<CheckCircle2 size={20} />} glowColor="green" />
        </div>

        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="ai_cleared">AI Cleared</option>
              <option value="flagged">Flagged</option>
              <option value="held">Held</option>
              <option value="rejected">Rejected</option>
              <option value="approved">Approved</option>
            </Select>
            <Select label="Method" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(0); }}>
              <option value="all">All</option>
              <option value="self">Self</option>
              <option value="usher">Usher Assisted</option>
              <option value="admin">Admin Entry</option>
            </Select>
            <Input label="Search" placeholder="Name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search size={14} />} />
            <Input label="From" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} />
            <Input label="To" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} />
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No submissions" description="Nothing to review right now." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button className="hover:text-white" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>Select all</button>
              <span>·</span>
              <button className="hover:text-white" onClick={() => setSelected(new Set())}>Deselect all</button>
            </div>
            <AnimatePresence>
              {items.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  selected={selected.has(s.id)}
                  onSelect={(v) => setSelected((prev) => {
                    const n = new Set(prev);
                    if (v) n.add(s.id); else n.delete(s.id);
                    return n;
                  })}
                  onReview={() => setReviewing(s)}
                  onApprove={() => handleApprove(s)}
                  onReject={() => setRejecting(s)}
                  approving={approvingIds.has(s.id)}
                />
              ))}
            </AnimatePresence>

            <div className="flex items-center justify-between pt-4 text-sm text-slate-400">
              <span>Page {page + 1} of {totalPages} — {total} submissions</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button size="sm" variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}

        {selectedList.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-2xl">
            <span className="text-sm text-white">{selectedList.length} selected</span>
            <Button size="sm" variant="success" disabled={!canBulkApprove} onClick={handleBulkApprove}>
              <CheckCircle2 size={14} /> Bulk Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </PageWrapper>

      <ReviewPanel
        submission={reviewing}
        onClose={() => setReviewing(null)}
        onApprove={(edits) => reviewing ? handleApprove(reviewing, edits) : Promise.resolve()}
        onReject={() => reviewing && setRejecting(reviewing)}
        onRequestInfo={() => showToast("Request info flow coming soon", "info")}
        approving={reviewing ? approvingIds.has(reviewing.id) : false}
      />

      <RejectModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => rejecting ? handleReject(rejecting, reason) : Promise.resolve()}
      />
    </AppLayout>
  );
}
