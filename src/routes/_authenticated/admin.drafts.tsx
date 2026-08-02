import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, LayoutDashboard, MessageCircle, ShieldCheck, Trash2, Users } from "lucide-react";
import { AppLayout, PageWrapper, Card, Button, Badge, EmptyState, StatCard, Spinner } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/admin/drafts")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: DraftsPage,
});

interface DraftRow {
  id: string;
  form_key: string;
  user_id: string | null;
  session_id: string | null;
  form_data: Record<string, unknown>;
  current_step: number;
  completeness_score: number;
  last_saved_at: string;
  created_at: string;
}

function extractPhone(data: Record<string, unknown>): string | null {
  const contact = data.contact as Record<string, unknown> | undefined;
  const raw = (contact?.phonePrimary ?? data.phone_primary ?? data.phonePrimary) as string | undefined;
  return raw ?? null;
}
function extractName(data: Record<string, unknown>): string | null {
  const personal = data.personal as Record<string, unknown> | undefined;
  const first = (personal?.firstName ?? data.first_name) as string | undefined;
  const last = (personal?.lastName ?? data.last_name) as string | undefined;
  return [first, last].filter(Boolean).join(" ") || null;
}

function relTime(iso: string) {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day(s) ago`;
}

function DraftsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToastContext();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("form_drafts" as never)
      .select("*")
      .order("last_saved_at", { ascending: false });
    setDrafts((data ?? []) as DraftRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this draft?")) return;
    await supabase.from("form_drafts" as never).delete().eq("id" as never, id as never);
    setDrafts((d) => d.filter((x) => x.id !== id));
    showToast("Draft deleted", "success");
  };

  const registrationDrafts = drafts.filter((d) => d.form_key === "public_registration");
  const anonymous = registrationDrafts.filter((d) => !d.user_id);

  return (
    <AppLayout
      title="Abandoned drafts"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Admin" }, { label: "Drafts" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
        { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => { await logout(); navigate({ to: "/auth" }); },
      }}
    >
      <PageWrapper>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Abandoned drafts</h1>
          <p className="text-sm text-slate-400 mt-1">Follow up with visitors who started a registration but did not finish.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total drafts" value={drafts.length} />
          <StatCard label="Public registration" value={registrationDrafts.length} />
          <StatCard label="Anonymous" value={anonymous.length} />
          <StatCard label="With phone" value={registrationDrafts.filter((d) => !!extractPhone(d.form_data)).length} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : registrationDrafts.length === 0 ? (
          <EmptyState title="No unfinished registrations" description="Once visitors start the public form, their in-progress work will show here." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Phone</th>
                    <th className="py-2 px-2">Step</th>
                    <th className="py-2 px-2">Complete</th>
                    <th className="py-2 px-2">Last saved</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationDrafts.map((d) => {
                    const phone = extractPhone(d.form_data);
                    const name = extractName(d.form_data);
                    return (
                      <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 px-2 text-white">{name ?? <span className="text-slate-600">— anonymous</span>}</td>
                        <td className="py-2 px-2 text-slate-300">{phone ?? "—"}</td>
                        <td className="py-2 px-2"><Badge>{d.current_step}/6</Badge></td>
                        <td className="py-2 px-2 text-slate-300">{d.completeness_score}%</td>
                        <td className="py-2 px-2 text-slate-500 text-xs">{relTime(d.last_saved_at)}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          {phone && (
                            <>
                              <button
                                onClick={() => { void navigator.clipboard.writeText(phone); showToast("Phone copied", "success"); }}
                                className="text-slate-400 hover:text-white p-1"
                                title="Copy phone"
                              ><Copy size={14} /></button>
                              <a
                                href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 p-1 inline-block"
                                title="Follow up on WhatsApp"
                              ><MessageCircle size={14} /></a>
                            </>
                          )}
                          <button
                            onClick={() => void remove(d.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Delete"
                          ><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageWrapper>
    </AppLayout>
  );
}
