import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SitePhoto } from "@/components/SitePhoto";

export const Route = createFileRoute("/give")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Giving | RCCG Shepherd's Hill" },
      {
        name: "description",
        content:
          "Online giving for RCCG Shepherd's Hill — tithes, offerings and seeds. Secure digital giving is coming soon.",
      },
      { property: "og:title", content: "Giving | RCCG Shepherd's Hill" },
      {
        property: "og:description",
        content: "Support the work of RCCG Shepherd's Hill. Online giving is coming soon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GivePage,
});

function GivePage() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0">
      <div className="max-w-xl mx-auto px-5 pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back home
        </Link>
        <SitePhoto contentKey="give_image" alt="Giving at RCCG Shepherd's Hill" className="mt-6 aspect-[16/7]" />
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #1A7A2A, #2EAD3F)" }}
          >
            <Heart size={24} className="text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Online giving is on the way</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We're setting up secure digital giving for tithes, offerings and seeds. Until then,
            please give at any service or speak with the finance team at the welcome desk.
          </p>
          <Link
            to="/visit"
            className="mt-6 inline-flex rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-soft"
          >
            Plan your visit
          </Link>
        </div>
      </div>
      <MobileTabBar isAuthed={!!user && !loading} />
    </div>
  );
}
