import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Search, ExternalLink } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Input, Spinner, EmptyState, StatCard } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/incomplete-profiles")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: IncompleteProfilesPage,
});

interface MemberRow {
  id: string;
  member_code: string | null;
  first_name: string;
  last_name: string;
  dob: string | null;
  gender: string | null;
  phone_primary: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  marital_status: string | null;
  cell_group_id: string | null;
  profile_photo_url: string | null;
}

const REQUIRED: { key: keyof MemberRow; label: string }[] = [
  { key: "dob", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "phone_primary", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "marital_status", label: "Marital status" },
  { key: "cell_group_id", label: "House Fellowship Centre" },
  { key: "profile_photo_url", label: "Photo" },
];

function missingFor(m: MemberRow) {
  return REQUIRED.filter((f) => !m[f.key]);
}

function IncompleteProfilesPage() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("id, member_code, first_name, last_name, dob, gender, phone_primary, email, address, city, state, marital_status, cell_group_id, profile_photo_url")
      .order("first_name");
    setRows((data ?? []) as MemberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const incomplete = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .map((m) => ({ m, missing: missingFor(m) }))
      .filter((x) => x.missing.length > 0)
      .filter((x) =>
        !term ||
        `${x.m.first_name} ${x.m.last_name}`.toLowerCase().includes(term) ||
        (x.m.member_code ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => b.missing.length - a.missing.length);
  }, [rows, q]);

  const avgScore = rows.length
    ? Math.round(rows.reduce((s, m) => s + ((REQUIRED.length - missingFor(m).length) / REQUIRED.length) * 100, 0) / rows.length)
    : 0;

  return (
    <AdminShell
      title="Incomplete Profiles"
      crumb="Incomplete Profiles"
      description="Members with missing details. Open a profile to fill in the gaps."
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total members" value={rows.length} icon={<UserCog size={18} />} />
        <StatCard label="Incomplete" value={incomplete.length} glowColor="amber" />
        <StatCard label="Avg. completeness" value={avgScore} unit="%" glowColor="green" />
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search name or member code" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : incomplete.length === 0 ? (
        <EmptyState icon={<UserCog size={40} />} title="All profiles complete" description="Every member record has the required details." />
      ) : (
        <div className="space-y-3">
          {incomplete.map(({ m, missing }) => {
            const score = Math.round(((REQUIRED.length - missing.length) / REQUIRED.length) * 100);
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold">{m.first_name} {m.last_name}</h3>
                      <Badge variant={score >= 70 ? "success" : score >= 40 ? "warning" : "danger"}>{score}%</Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{m.member_code ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {missing.map((f) => (
                        <span key={String(f.key)} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link to="/members/$id" params={{ id: m.id }}>
                    <Button size="sm" variant="secondary"><ExternalLink size={14} /> Open profile</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
