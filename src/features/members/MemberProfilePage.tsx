import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, Check, Copy, Edit, Fingerprint, Flag, Heart, LayoutDashboard,
  MessageSquare, MoreHorizontal, QrCode, ScanFace, ShieldCheck, User, Users,
} from "lucide-react";
import { AppLayout, PageWrapper, StatCard, Button, Card, Badge, EmptyState, Avatar } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { FamilyGroupBadge } from "@/components/FamilyGroupBadge";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";
import { EditableSection } from "./EditableSection";
import { MemberDepartments } from "./MemberDepartments";
import { TERMS } from "@/constants/terminology";
import { MEMBERSHIP_STAGES } from "@/constants/membershipStages";
import { isAdmin as roleIsAdmin, isPastoral } from "@/lib/roles";

interface MemberFull {
  id: string;
  member_code: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  preferred_name: string | null;
  dob: string | null;
  gender: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  marital_status: string | null;
  membership_status: string;
  membership_stage: string | null;
  profile_photo_url: string | null;
  branch_id: string | null;
  cell_group_id: string | null;
  created_at: string;
}

type Tab = "overview" | "spiritual" | "family" | "biometrics" | "activity" | "giving" | "pastoral";

const TABS: { id: Tab; label: string; pastoralOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "spiritual", label: "Spiritual Journey" },
  { id: "family", label: "Family" },
  { id: "biometrics", label: "Biometrics" },
  { id: "activity", label: "Activity" },
  { id: "giving", label: "Giving" },
  { id: "pastoral", label: "Pastoral Care", pastoralOnly: true },
];

export function MemberProfilePage({ memberId }: { memberId: string }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberFull | null>(null);
  const [cellGroup, setCellGroup] = useState<{ name: string; leader_name: string | null } | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [journey, setJourney] = useState<{ milestone: string; status: string; recorded_at: string | null }[]>([]);
  const [biometrics, setBiometrics] = useState<{ has_face: boolean; has_fingerprint: boolean; has_qr: boolean; qr_code: string | null } | null>(null);
  const [incompleteness, setIncompleteness] = useState<{ score: number; missing: string[] } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const roles = user?.roles ?? [];
  const canViewPastoral = isPastoral(roles);
  const canEdit = roleIsAdmin(roles);
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});
  const hasUnsaved = Object.values(dirtySections).some(Boolean);

  // Warn before leaving the page with unsaved section edits
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);



  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [{ data: m }, { data: dm }, { data: sj }, { data: bio }, { data: inc }] = await Promise.all([
        supabase.from("members").select("*").eq("id", memberId).maybeSingle(),
        supabase.from("department_members").select("departments(name)").eq("member_id", memberId),
        supabase.from("spiritual_journey").select("milestone, status, recorded_at").eq("member_id", memberId),
        supabase.from("member_biometrics").select("has_face, has_fingerprint, has_qr, qr_code").eq("member_id", memberId).maybeSingle(),
        supabase.from("incomplete_profiles").select("completeness_score, missing_fields").eq("member_id", memberId).maybeSingle(),
      ]);
      if (cancelled) return;
      const mm = m as MemberFull | null;
      setMember(mm);
      if (mm?.cell_group_id) {
        const { data: cg } = await supabase.from("cell_groups").select("name, leader_name").eq("id", mm.cell_group_id).maybeSingle();
        setCellGroup(cg as { name: string; leader_name: string | null } | null);
      }
      const deptRows = (dm ?? []) as { departments: { name: string } | null }[];
      setDepartments(deptRows.map((r) => r.departments?.name).filter(Boolean) as string[]);
      setJourney((sj ?? []) as { milestone: string; status: string; recorded_at: string | null }[]);
      setBiometrics(bio as { has_face: boolean; has_fingerprint: boolean; has_qr: boolean; qr_code: string | null } | null);
      const incRow = inc as { completeness_score?: number; missing_fields?: string[] } | null;
      setIncompleteness(incRow ? { score: incRow.completeness_score ?? 0, missing: (incRow.missing_fields ?? []) as string[] } : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  const tenure = useMemo(() => {
    if (!member?.created_at) return { years: 0, months: 0, label: "New" };
    const start = new Date(member.created_at);
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const y = Math.floor(months / 12);
    const m = months % 12;
    return { years: y, months: m, label: y > 0 ? `${y}y ${m}m` : `${m}m` };
  }, [member]);

  const completeness = incompleteness?.score ?? 100;
  const dashOffset = 2 * Math.PI * 30 * (1 - completeness / 100);

  const copyCode = async () => {
    if (!member?.member_code) return;
    await navigator.clipboard.writeText(member.member_code);
    showToast("Member code copied", "success");
  };

  const flagForCare = async () => {
    // Basic placeholder — creates a system_log entry until care_cases table lands
    await supabase.from("system_logs" as never).insert({
      action: "flag_pastoral_care",
      performed_by: user?.id ?? null,
      performed_by_name: user?.profile?.full_name ?? user?.email ?? "unknown",
      details: { member_id: memberId },
    } as never);
    showToast("Flagged for pastoral follow-up", "success");
  };

  return (
    <AppLayout
      title="Member profile"
      breadcrumb={[
        { label: "Home", href: "/dashboard" },
        { label: "Members", href: "/members" },
        { label: member ? `${member.first_name} ${member.last_name}` : "…" },
      ]}
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
        <button
          onClick={() => {
            if (hasUnsaved && !window.confirm("You have unsaved changes. Leave without saving?")) return;
            void navigate({ to: "/members" });
          }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Back to Members
        </button>

        {hasUnsaved && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            You have unsaved changes in one or more sections.
          </div>
        )}

        {loading ? <ProfileSkeleton /> : !member ? (
          <EmptyState icon={<User size={40} className="text-slate-400" />} title="Member not found" description="This profile may have been removed" />
        ) : (
          <>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-blue-500/[0.08] p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 blur-md opacity-70" />
                  <Avatar name={`${member.first_name} ${member.last_name}`} src={member.profile_photo_url ?? undefined} size="lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-white truncate">{member.first_name} {member.middle_name} {member.last_name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">{member.member_code ?? "—"}</code>
                    {member.member_code && (
                      <button onClick={copyCode} className="text-slate-500 hover:text-white transition-colors" aria-label="Copy code">
                        <Copy size={12} />
                      </button>
                    )}
                    {member.membership_stage && (
                      <Badge variant="purple">{member.membership_stage.replace("_", " ")}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cellGroup && <Badge variant="info">{cellGroup.name}</Badge>}
                    {departments.slice(0, 3).map((d) => <Badge key={d} variant="success">{d}</Badge>)}
                    {departments.length > 3 && <Badge>+{departments.length - 3} more</Badge>}
                  </div>
                </div>
                {/* Completeness ring */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 68 68" className="w-20 h-20 -rotate-90">
                    <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle cx="34" cy="34" r="30" fill="none" stroke="url(#g1)" strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 30} strokeDashoffset={dashOffset} strokeLinecap="round" />
                    <defs>
                      <linearGradient id="g1" x1="0" x2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#3b82f6" /></linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-white">{completeness}%</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500">Complete</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                <Button size="sm" variant="secondary" onClick={() => { setTab("overview"); showToast("Use the Edit button on each section below", "info"); }}><Edit size={14} /> Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => showToast("Messaging arrives in Sprint 2", "info")}><MessageSquare size={14} /> Message</Button>
                <Button size="sm" variant="secondary" onClick={flagForCare}><Flag size={14} /> Flag for Care</Button>
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                    <ArrowLeftRight size={14} /> Transfer
                  </Button>
                )}
                <Button size="sm" variant="ghost"><MoreHorizontal size={14} /></Button>
              </div>

              <TransferModal
                open={transferOpen}
                onClose={() => setTransferOpen(false)}
                memberId={member.id}
                memberName={`${member.first_name} ${member.last_name}`}
                currentBranchId={member.branch_id}
                currentCellGroupId={member.cell_group_id}
              />

            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <TextStat label="Tenure" value={tenure.label} icon={<User size={20} />} />
              <TextStat label="Attendance rate" value="0%" icon={<Check size={20} />} hint="Sprint 3" />
              <TextStat label="Total giving" value="₦0" icon={<Heart size={20} />} hint="Sprint 4" />
              <StatCard label="Active departments" value={departments.length} icon={<Users size={20} />} />
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-white/10 mb-6 scrollbar-none">
              {TABS.filter((t) => !t.pastoralOnly || canViewPastoral).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t.id ? "border-violet-500 text-white" : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >{t.label}</button>
              ))}
            </div>

            {tab === "overview" && (
              <OverviewTab
                member={member}
                cellGroup={cellGroup}
                canEdit={canEdit}
                onPatch={(patch) => setMember((prev) => (prev ? ({ ...prev, ...patch } as MemberFull) : prev))}
                onDirtyChange={(section, d) => setDirtySections((prev) => ({ ...prev, [section]: d }))}
              />
            )}
            {tab === "spiritual" && <SpiritualTab journey={journey} />}
            {tab === "family" && <FamilyTab />}
            {tab === "biometrics" && <BiometricsTab bio={biometrics} memberCode={member.member_code ?? ""} name={`${member.first_name} ${member.last_name}`} />}
            {tab === "activity" && <ActivityTab />}
            {tab === "giving" && <GivingTab />}
            {tab === "pastoral" && canViewPastoral && <PastoralTab onFlag={flagForCare} />}
          </>
        )}
      </PageWrapper>
    </AppLayout>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-40 rounded-3xl bg-white/[0.03] border border-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/5" />)}
      </div>
      <div className="h-10 rounded-xl bg-white/[0.03] border border-white/5" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/5" />
        <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/5" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-200 text-right ml-4">{value ?? "—"}</span>
    </div>
  );
}

function OverviewTab({
  member,
  cellGroup,
  canEdit,
  onPatch,
  onDirtyChange,
}: {
  member: MemberFull;
  cellGroup: { name: string; leader_name: string | null } | null;
  canEdit: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onDirtyChange: (section: string, dirty: boolean) => void;
}) {
  const values = member as unknown as Record<string, unknown>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <EditableSection
        title="Personal"
        memberId={member.id}
        canEdit={canEdit}
        values={values}
        onSaved={onPatch}
        onDirtyChange={(d) => onDirtyChange("personal", d)}
        fields={[
          { key: "first_name", label: "First name" },
          { key: "middle_name", label: "Middle name" },
          { key: "last_name", label: "Last name" },
          { key: "preferred_name", label: "Preferred name" },
          { key: "dob", label: "Date of birth", type: "date" },
          {
            key: "gender",
            label: "Gender",
            type: "select",
            options: [
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ],
          },
        ]}
      />

      <EditableSection
        title="Contact"
        memberId={member.id}
        canEdit={canEdit}
        values={values}
        onSaved={onPatch}
        onDirtyChange={(d) => onDirtyChange("contact", d)}
        fields={[
          { key: "phone_primary", label: "Primary phone", type: "tel" },
          { key: "phone_secondary", label: "Secondary phone", type: "tel" },
          { key: "email", label: "Email", type: "email" },
          { key: "address", label: "Address" },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "country", label: "Country" },
        ]}
      />

      <EditableSection
        title="Family"
        memberId={member.id}
        canEdit={canEdit}
        values={values}
        onSaved={onPatch}
        onDirtyChange={(d) => onDirtyChange("family", d)}
        fields={[
          {
            key: "marital_status",
            label: "Marital status",
            type: "select",
            options: [
              { value: "single", label: "Single" },
              { value: "married", label: "Married" },
              { value: "widowed", label: "Widowed" },
              { value: "divorced", label: "Divorced" },
            ],
          },
        ]}
      />

      <EditableSection
        title="Church details"
        memberId={member.id}
        canEdit={canEdit}
        values={{
          ...values,
          hfc_name: cellGroup?.name ?? "",
          coordinator: cellGroup?.leader_name ?? "",
          joined: new Date(member.created_at).toLocaleDateString(),
        }}
        onSaved={onPatch}
        onDirtyChange={(d) => onDirtyChange("church", d)}
        fields={[
          { key: "hfc_name", label: TERMS.CELL_GROUP, readOnly: true },
          { key: "coordinator", label: TERMS.CELL_LEADER, readOnly: true },
          {
            key: "membership_stage",
            label: "Membership stage",
            type: "select",
            options: MEMBERSHIP_STAGES.map((s) => ({ value: s.key, label: s.label })),
          },
          {
            key: "membership_status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "transferred", label: "Transferred" },
            ],
          },
          { key: "joined", label: "Joined", readOnly: true },
        ]}
      />

      <Card title="Family Group">
        <div className="flex flex-col gap-3">
          <FamilyGroupBadge memberId={member.id} showScheme size="lg" />
          <MemberFamilyGroupAssign memberId={member.id} />
        </div>
      </Card>

      <MemberDepartments memberId={member.id} canEdit={canEdit} />
    </div>

  );
}

function MemberFamilyGroupAssign({ memberId }: { memberId: string }) {
  const { showToast } = useToastContext();
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.from("member_family_groups").select("id").eq("member_id", memberId).eq("is_active", true).maybeSingle()
      .then(({ data }) => setAssigned(!!data));
  }, [memberId]);
  if (assigned === null || assigned) return null;
  const doAssign = async () => {
    setAssigning(true);
    try {
      const { error } = await supabase.rpc("assign_member_family_group", { p_member_id: memberId });
      if (error) throw error;
      showToast("Family group assigned", "success");
      setAssigned(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Assignment failed", "error");
    } finally {
      setAssigning(false);
    }
  };
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center justify-between gap-2">
      <span>Family group will be assigned automatically based on age and marital status.</span>
      <Button size="sm" variant="secondary" onClick={doAssign} loading={assigning}>Assign Now</Button>
    </div>
  );
}

const STAGES_ORDER = ["salvation", "believers_class", "baptised", "baptismal_class", "worker_training"] as const;

function SpiritualTab({ journey }: { journey: { milestone: string; status: string; recorded_at: string | null }[] }) {
  const byMilestone = new Map(journey.map((j) => [j.milestone, j]));
  return (
    <Card title="Spiritual journey">
      <div className="relative pl-6">
        <div className="absolute top-0 bottom-0 left-2 w-px bg-white/10" />
        {STAGES_ORDER.map((m, i) => {
          const j = byMilestone.get(m);
          const status = j?.status ?? "not_started";
          const isDone = status === "completed" || status === "yes";
          const isProg = status === "in_progress";
          return (
            <motion.div
              key={m}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative mb-5"
            >
              <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full flex items-center justify-center ${isDone ? "bg-emerald-500" : isProg ? "bg-violet-500 animate-pulse" : "bg-white/10 border border-white/20"}`}>
                {isDone && <Check size={10} className="text-white" />}
              </div>
              <div className="text-sm text-white capitalize">{m.replace(/_/g, " ")}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {isDone && `Completed${j?.recorded_at ? ` · ${new Date(j.recorded_at).toLocaleDateString()}` : ""}`}
                {isProg && "In progress"}
                {!isDone && !isProg && "Not started"}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

function FamilyTab() {
  return (
    <Card title="Family members">
      <EmptyState
        icon={<Heart size={32} className="text-slate-400" />}
        title="Family relationships coming soon"
        description="Family member linking will be enabled in Sprint 1D"
      />
    </Card>
  );
}

function BiometricsTab({ bio, memberCode, name }: { bio: { has_face: boolean; has_fingerprint: boolean; has_qr: boolean; qr_code: string | null } | null; memberCode: string; name: string }) {
  const items = [
    { label: "Face Recognition", icon: ScanFace, enrolled: !!bio?.has_face },
    { label: "Fingerprint", icon: Fingerprint, enrolled: !!bio?.has_fingerprint },
    { label: "QR Code", icon: QrCode, enrolled: !!bio?.has_qr, canDownload: true },
  ];
  const downloadQr = () => {
    if (typeof window === "undefined") return;
    const html = `<html><body style="font-family: sans-serif; text-align:center; padding:40px;"><h1>${name}</h1><p>${memberCode}</p><div style="border:2px dashed #999; padding:40px; margin:20px auto; width:200px;">QR: ${bio?.qr_code ?? memberCode}</div></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.label}>
          <div className="flex items-center justify-between mb-3">
            <it.icon size={20} className="text-violet-400" />
            {it.enrolled ? <Badge variant="success">Enrolled</Badge> : <Badge variant="warning">Not enrolled</Badge>}
          </div>
          <div className="text-sm font-medium text-white">{it.label}</div>
          <div className="text-xs text-slate-500 mt-1">{it.enrolled ? "Last used —" : "Ready to enrol"}</div>
          <div className="mt-4">
            {it.canDownload ? (
              <Button size="sm" variant="secondary" onClick={downloadQr}>Download QR</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => window.open("/kiosk", "_blank")}>Enrol at kiosk</Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ActivityTab() {
  return (
    <Card title="Recent activity">
      <EmptyState icon={<Check size={32} className="text-slate-400" />} title="No activity yet" description="Attendance, giving and pastoral notes will appear here as they are recorded" />
    </Card>
  );
}
function GivingTab() {
  return (
    <Card title="Giving summary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TextStat label="This year" value="₦0" />
        <TextStat label="Last year" value="₦0" />
        <TextStat label="Tithes" value="₦0" />
        <TextStat label="Offerings" value="₦0" />
      </div>
      <div className="text-sm text-slate-500 text-center py-8">
        Giving history will appear here once the Finance module is set up
      </div>
    </Card>
  );
}
function PastoralTab({ onFlag }: { onFlag: () => void }) {
  return (
    <Card title="Pastoral care">
      <div className="text-sm text-slate-500 mb-4">
        Pastoral care records will appear here once the Pastoral Care module is set up
      </div>
      <Button size="sm" variant="primary" onClick={onFlag}><Flag size={14} /> Flag for follow-up</Button>
    </Card>
  );
}

function TextStat({ label, value, icon, hint }: { label: string; value: string; icon?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-[10px] text-slate-600 mt-1">{hint}</div>}
    </div>
  );
}
