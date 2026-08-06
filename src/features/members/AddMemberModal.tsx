import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, User, Church, ClipboardCheck, X, Loader2 } from "lucide-react";
import { Modal, Button, Badge, Spinner } from "@/components/ds";
import { SmartInput, SmartSelect, SmartTextarea, DraftResumeBanner, FormSaveIndicator } from "@/components/global";
import { useFormDraft } from "@/hooks/useFormDraft";
import { supabase } from "@/integrations/supabase/client";
import { formatNigerianPhone, isValidNigerianPhone, NIGERIAN_STATES } from "@/lib/nigeria";
import { useToastContext } from "@/components/ds/Toast";

interface Options {
  cellGroups: { id: string; name: string }[];
  departments: { id: string; name: string; icon: string | null }[];
  branches: { id: string; name: string; branch_code: string }[];
}

interface AddMemberData {
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  dob: string;
  gender: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  marital_status: string;
  spouse_name: string;
  spouse_phone: string;
  membership_stage: string;
  cell_group_id: string;
  department_ids: string[];
  join_date: string;
  how_they_heard: string;
  notes: string;
  spiritual: {
    salvation: string;
    baptised: string;
    believers_class: string;
    baptismal_class: string;
  };
  send_welcome: boolean;
  create_login: boolean;
  branch_id: string;
  photo_url: string;
}

const empty = (branchId: string): AddMemberData => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  preferred_name: "",
  dob: "",
  gender: "",
  phone_primary: "",
  phone_secondary: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  marital_status: "",
  spouse_name: "",
  spouse_phone: "",
  membership_stage: "new_member",
  cell_group_id: "",
  department_ids: [],
  join_date: new Date().toISOString().slice(0, 10),
  how_they_heard: "",
  notes: "",
  spiritual: { salvation: "", baptised: "", believers_class: "", baptismal_class: "" },
  send_welcome: true,
  create_login: true,
  branch_id: branchId,
  photo_url: "",
});

const STAGES = [
  { value: "first_timer", label: "First Timer" },
  { value: "new_convert", label: "New Convert" },
  { value: "new_member", label: "New Member" },
  { value: "member", label: "Member" },
  { value: "worker", label: "Worker" },
  { value: "leader", label: "Leader" },
];

export interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (memberId: string, memberCode: string, name: string) => void;
  branchId: string;
  branchCode: string;
}

export function AddMemberModal({ open, onClose, onCreated, branchId, branchCode }: AddMemberModalProps) {
  const { showToast } = useToastContext();
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<AddMemberData>(() => empty(branchId));
  const [options, setOptions] = useState<Options>({ cellGroups: [], departments: [], branches: [] });
  const [nextCode, setNextCode] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dupCheck, setDupCheck] = useState<"idle" | "checking" | "duplicate" | "clear">("idle");

  const formKey = `admin_add_member_${branchId || "default"}`;
  const { draft, saveDraft, clearDraft, lastSaved, isSaving } = useFormDraft(formKey);

  const patch = (p: Partial<AddMemberData>) => setData((d) => ({ ...d, ...p }));

  // Load options
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [cg, dp, br] = await Promise.all([
        supabase.from("cell_groups").select("id, name").eq("is_active", true).order("name"),
        supabase.from("departments").select("id, name, icon").eq("is_active", true).order("name"),
        supabase.from("branches").select("id, name, branch_code"),
      ]);
      setOptions({
        cellGroups: (cg.data as { id: string; name: string }[]) ?? [],
        departments: (dp.data as { id: string; name: string; icon: string | null }[]) ?? [],
        branches: (br.data as { id: string; name: string; branch_code: string }[]) ?? [],
      });
    })();
  }, [open]);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setTab(0);
      setData(empty(branchId));
    }
  }, [open, branchId]);

  // Preview next member code
  useEffect(() => {
    if (tab !== 2) return;
    void (async () => {
      setNextCode(await nextMemberCode());
    })();
  }, [tab]);


  // Auto-save
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => { void saveDraft(data as unknown as Record<string, unknown>, tab, computeScore(data)); }, 30_000);
    return () => clearInterval(t);
  }, [open, data, tab, saveDraft]);

  // beforeunload
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      try {
        window.localStorage.setItem(
          `draft_${formKey}`,
          JSON.stringify({ formData: data, currentStep: tab, completenessScore: computeScore(data), lastSavedAt: new Date().toISOString() }),
        );
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, data, tab, formKey]);

  // Duplicate phone check
  const checkDuplicate = async (phone: string) => {
    if (!phone || !isValidNigerianPhone(phone)) { setDupCheck("idle"); return; }
    setDupCheck("checking");
    const formatted = formatNigerianPhone(phone);
    const { data: exists } = await supabase.from("members").select("id").eq("phone_primary", formatted).maybeSingle();
    setDupCheck(exists ? "duplicate" : "clear");
  };

  const canGoNext = useMemo(() => {
    if (tab === 0) {
      return !!(data.first_name && data.last_name && data.gender && data.phone_primary && isValidNigerianPhone(data.phone_primary) && dupCheck !== "duplicate");
    }
    if (tab === 1) return !!data.membership_stage && !!data.join_date;
    return true;
  }, [tab, data, dupCheck]);

  const resume = () => {
    if (!draft) return;
    setData(draft.formData as unknown as AddMemberData);
    setTab(draft.currentStep);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const prefix = `${branchCode}-${year}-`;
      const { data: last } = await supabase
        .from("members")
        .select("member_code")
        .eq("branch_id", branchId)
        .like("member_code", `${prefix}%`)
        .order("member_code", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastCode = (last as { member_code?: string | null } | null)?.member_code;
      let n = 1;
      if (lastCode) { const m = /(\d+)$/.exec(lastCode); if (m) n = parseInt(m[1], 10) + 1; }
      const memberCode = `${prefix}${String(n).padStart(4, "0")}`;

      const insertPayload = {
        member_code: memberCode,
        first_name: data.first_name,
        last_name: data.last_name,
        middle_name: data.middle_name || null,
        preferred_name: data.preferred_name || null,
        dob: data.dob || null,
        gender: data.gender || null,
        phone_primary: formatNigerianPhone(data.phone_primary),
        phone_secondary: data.phone_secondary ? formatNigerianPhone(data.phone_secondary) : null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "Nigeria",
        marital_status: data.marital_status || null,
        membership_status: "active",
        membership_stage: data.membership_stage,
        branch_id: branchId,
        cell_group_id: data.cell_group_id || null,
        profile_photo_url: data.photo_url || null,
      };
      const { data: inserted, error } = await supabase
        .from("members")
        .insert(insertPayload as never)
        .select("id, member_code")
        .single();
      if (error) throw error;
      const memberId = (inserted as { id: string }).id;

      // Departments
      if (data.department_ids.length) {
        await supabase.from("department_members").insert(
          data.department_ids.map((did) => ({ member_id: memberId, department_id: did, role_title: null })) as never,
        );
      }
      // Spiritual journey
      const sjRows = Object.entries(data.spiritual)
        .filter(([, v]) => !!v)
        .map(([milestone, status]) => ({ member_id: memberId, milestone, status }));
      if (sjRows.length) await supabase.from("spiritual_journey").insert(sjRows as never);

      // Biometrics row with QR
      await supabase.from("member_biometrics").insert({ member_id: memberId, qr_code: memberCode, has_qr: false } as never);

      // Optional side-effects (both stubbed via edge functions)
      if (data.create_login && data.email) {
        try { await supabase.functions.invoke("invite-member", { body: { email: data.email, memberId } }); } catch { /* stub */ }
      }
      if (data.send_welcome) {
        try { await supabase.functions.invoke("send-welcome-notification", { body: { memberId } }); } catch { /* stub */ }
      }

      await clearDraft();
      onCreated(memberId, memberCode, `${data.first_name} ${data.last_name}`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create member", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex w-full items-center justify-between">
      <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setTab((t) => Math.max(0, t - 1))} disabled={tab === 0 || submitting}>
          <ChevronLeft size={14} /> Previous
        </Button>
        {tab < 2 ? (
          <Button variant="primary" onClick={() => { void saveDraft(data as unknown as Record<string, unknown>, tab + 1, computeScore(data)); setTab((t) => Math.min(2, t + 1)); }} disabled={!canGoNext || submitting}>
            Next <ChevronRight size={14} />
          </Button>
        ) : (
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            <Check size={14} /> Create Member
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" title="Add New Member" footer={footer}>
      <DraftResumeBanner
        draft={draft}
        totalSteps={3}
        onResume={resume}
        onDiscard={() => { void clearDraft(); }}
      />

      <div className="mb-5 flex gap-1 border-b border-white/10">
        {[
          { i: 0, label: "Personal", icon: User },
          { i: 1, label: "Church Details", icon: Church },
          { i: 2, label: "Confirm", icon: ClipboardCheck },
        ].map(({ i, label, icon: Icon }) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === i ? "border-violet-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SmartInput fieldKey="addmember.first_name" label="First name" required value={data.first_name} onValueChange={(v) => patch({ first_name: v })} />
          <SmartInput fieldKey="addmember.middle_name" label="Middle name" value={data.middle_name} onValueChange={(v) => patch({ middle_name: v })} />
          <SmartInput fieldKey="addmember.last_name" label="Last name" required value={data.last_name} onValueChange={(v) => patch({ last_name: v })} />
          <SmartInput fieldKey="addmember.preferred_name" label="Preferred name" value={data.preferred_name} onValueChange={(v) => patch({ preferred_name: v })} />
          <SmartInput type="date" label="Date of birth" value={data.dob} onChange={(e) => patch({ dob: e.target.value })} fieldKey="addmember.dob" />
          <SmartSelect fieldKey="addmember.gender" label="Gender" required value={data.gender} onValueChange={(v) => patch({ gender: v })}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SmartSelect>
          <SmartInput
            fieldKey="addmember.phone_primary"
            label="Primary phone"
            required
            value={data.phone_primary}
            onValueChange={(v) => { patch({ phone_primary: v }); void checkDuplicate(v); }}
            hint={dupCheck === "duplicate" ? "This phone is already registered" : dupCheck === "checking" ? "Checking…" : "Nigerian format"}
            error={dupCheck === "duplicate" ? "Duplicate phone number" : undefined}
          />
          <SmartInput fieldKey="addmember.phone_secondary" label="Secondary phone" value={data.phone_secondary} onValueChange={(v) => patch({ phone_secondary: v })} />
          <SmartInput fieldKey="addmember.email" type="email" label="Email" value={data.email} onValueChange={(v) => patch({ email: v })} />
          <SmartInput fieldKey="addmember.address" label="Address" value={data.address} onValueChange={(v) => patch({ address: v })} />
          <SmartInput fieldKey="addmember.city" label="City" value={data.city} onValueChange={(v) => patch({ city: v })} />
          <SmartSelect fieldKey="addmember.state" label="State" value={data.state} onValueChange={(v) => patch({ state: v })}>
            <option value="">Select…</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SmartSelect>
          <SmartSelect fieldKey="addmember.marital_status" label="Marital status" value={data.marital_status} onValueChange={(v) => patch({ marital_status: v })}>
            <option value="">Select…</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="widowed">Widowed</option>
            <option value="divorced">Divorced</option>
          </SmartSelect>
          {data.marital_status === "married" && (
            <>
              <SmartInput fieldKey="addmember.spouse_name" label="Spouse name" value={data.spouse_name} onValueChange={(v) => patch({ spouse_name: v })} />
              <SmartInput fieldKey="addmember.spouse_phone" label="Spouse phone" value={data.spouse_phone} onValueChange={(v) => patch({ spouse_phone: v })} />
            </>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SmartSelect fieldKey="addmember.stage" label="Membership stage" required value={data.membership_stage} onValueChange={(v) => patch({ membership_stage: v })}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SmartSelect>
            <SmartSelect fieldKey="addmember.cell_group" label="House Fellowship Centre" value={data.cell_group_id} onValueChange={(v) => patch({ cell_group_id: v })}>
              <option value="">Unassigned</option>
              {options.cellGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SmartSelect>
            <SmartInput type="date" label="Join date" fieldKey="addmember.join_date" value={data.join_date} onChange={(e) => patch({ join_date: e.target.value })} />
            <SmartInput fieldKey="addmember.how_heard" label="How did they hear?" value={data.how_they_heard} onValueChange={(v) => patch({ how_they_heard: v })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Departments</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {options.departments.map((d) => {
                const checked = data.department_ids.includes(d.id);
                return (
                  <label key={d.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${checked ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/10 text-slate-400"}`}>
                    <input type="checkbox" checked={checked} onChange={(e) => patch({ department_ids: e.target.checked ? [...data.department_ids, d.id] : data.department_ids.filter((x) => x !== d.id) })} />
                    {d.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Spiritual journey</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(["salvation", "baptised", "believers_class", "baptismal_class"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-slate-300 capitalize">{k.replace("_", " ")}</span>
                  <select
                    className="bg-transparent text-xs text-white focus:outline-none"
                    value={data.spiritual[k]}
                    onChange={(e) => patch({ spiritual: { ...data.spiritual, [k]: e.target.value } })}
                  >
                    <option className="bg-[#0d1117]" value="">—</option>
                    <option className="bg-[#0d1117]" value="not_started">Not Started</option>
                    <option className="bg-[#0d1117]" value="in_progress">In Progress</option>
                    <option className="bg-[#0d1117]" value="completed">Completed</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
          <SmartTextarea fieldKey="addmember.notes" label="Internal notes (not shown to member)" value={data.notes} onValueChange={(v) => patch({ notes: v })} />
        </div>
      )}

      {tab === 2 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Member code preview</div>
                <div className="text-lg font-mono text-white mt-1">{nextCode || <Spinner />}</div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Row label="Name" value={`${data.first_name} ${data.middle_name} ${data.last_name}`.trim()} />
              <Row label="Phone" value={data.phone_primary} />
              <Row label="Email" value={data.email || "—"} />
              <Row label="Stage" value={STAGES.find((s) => s.value === data.membership_stage)?.label ?? data.membership_stage} />
              <Row label="House Fellowship Centre" value={options.cellGroups.find((c) => c.id === data.cell_group_id)?.name ?? "Unassigned"} />
              <Row label="Departments" value={data.department_ids.length ? String(data.department_ids.length) : "None"} />
              <Row label="Join date" value={data.join_date} />
            </div>
          </div>

          <div className="space-y-2">
            <ToggleRow label="Send welcome notification" checked={data.send_welcome} onChange={(v) => patch({ send_welcome: v })} />
            <ToggleRow label="Create login account (email invite)" checked={data.create_login} onChange={(v) => patch({ create_login: v })} disabled={!data.email} />
            {!data.email && data.create_login && (
              <p className="text-xs text-amber-400">An email is required to send a login invite.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 -mx-6 -mb-6">
        <FormSaveIndicator isSaving={isSaving} lastSaved={lastSaved} draftExists={!!draft} />
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="text-white truncate">{value}</span>
    </>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function computeScore(d: AddMemberData): number {
  const fields = [d.first_name, d.last_name, d.phone_primary, d.gender, d.membership_stage, d.email, d.address, d.dob, d.state];
  const filled = fields.filter((v) => !!v).length;
  return Math.round((filled / fields.length) * 100);
}
