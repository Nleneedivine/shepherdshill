import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText, LayoutDashboard, Printer, ShieldCheck, Users } from "lucide-react";
import { AppLayout, PageWrapper, Card, Button, Badge } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateRegistrationPdf, FORM_VERSION } from "@/lib/generateRegistrationPdf";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/admin/forms/registration-form")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: RegistrationFormPage,
});

function RegistrationFormPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToastContext();
  const [downloadCount, setDownloadCount] = useState(0);

  useEffect(() => {
    void (async () => {
      const { count } = await supabase
        .from("system_logs" as never)
        .select("id", { count: "exact", head: true })
        .eq("action" as never, "form_downloaded" as never);
      setDownloadCount(count ?? 0);
    })();
  }, []);

  const log = async () => {
    await supabase.from("system_logs" as never).insert({
      action: "form_downloaded",
      performed_by: user?.id ?? null,
      performed_by_name: user?.profile?.full_name ?? user?.email ?? "unknown",
      details: { form: "physical_registration_form", version: FORM_VERSION },
    } as never);
    setDownloadCount((c) => c + 1);
  };

  const download = async () => {
    const doc = generateRegistrationPdf();
    doc.save(`shepherds-hill-registration-form-${FORM_VERSION}.pdf`);
    await log();
    showToast("Form downloaded", "success");
  };

  const printNow = async () => {
    const doc = generateRegistrationPdf();
    doc.autoPrint();
    const url = doc.output("bloburl");
    if (typeof window !== "undefined") window.open(url as unknown as string, "_blank");
    await log();
  };

  return (
    <AppLayout
      title="Physical registration form"
      breadcrumb={[
        { label: "Home", href: "/dashboard" },
        { label: "Admin" },
        { label: "Forms" },
      ]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
        { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
        { label: "Forms", href: "/admin/forms/registration-form", icon: FileText, active: true },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => { await logout(); navigate({ to: "/auth" }); },
      }}
    >
      <PageWrapper>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Physical Registration Form</h1>
          <p className="text-sm text-slate-400 mt-1">Download and print for members without smartphones.</p>
        </div>

        <Card>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-24 h-32 rounded-lg border-2 border-dashed border-white/15 bg-white/5 flex flex-col items-center justify-center text-slate-500 text-[10px] text-center p-1">
              <FileText size={24} className="mb-1" /> A4 · 2 pages
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-semibold text-white">Standard registration form</h2>
                <Badge variant="purple">{FORM_VERSION}</Badge>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Two-page A4 form covering personal, contact, family, church life, spiritual journey, and consent. Print double-sided.
              </p>
              <p className="text-xs text-amber-300/80 mb-4">
                Print on A4 paper. Select 'Both sides' for double-sided printing. Do not scale — print at 100%.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={download}><Download size={14} /> Download (English)</Button>
                <Button variant="secondary" disabled title="Coming soon">Download (Yoruba)</Button>
                <Button variant="secondary" disabled title="Coming soon">Download (Igbo)</Button>
                <Button variant="secondary" onClick={printNow}><Printer size={14} /> Print now</Button>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                This form has been downloaded <span className="text-slate-300 font-medium">{downloadCount}</span> time{downloadCount === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        </Card>
      </PageWrapper>
    </AppLayout>
  );
}
