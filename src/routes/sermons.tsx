import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mic2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileTabBar } from "@/components/MobileTabBar";

export const Route = createFileRoute("/sermons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sermon Archive | RCCG Shepherd's Hill" },
      {
        name: "description",
        content:
          "Messages from RCCG Shepherd's Hill — the searchable sermon archive is being prepared.",
      },
      { property: "og:title", content: "Sermon Archive | RCCG Shepherd's Hill" },
      {
        property: "og:description",
        content: "Every message from RCCG Shepherd's Hill, in one place. Coming soon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SermonsPage,
});

function SermonsPage() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-[#080C16] text-white pb-24 md:pb-0">
      <div className="max-w-xl mx-auto px-5 pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back home
        </Link>
        <div className="mt-10 rounded-2xl border border-white/10 bg-[#0D1117] p-8 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #0284C7, #0EA5E9)" }}
          >
            <Mic2 size={24} className="text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Sermon archive</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            We're gathering and cataloguing past messages. Soon you'll be able to search, stream
            and share every word preached at Shepherd's Hill.
          </p>
        </div>
      </div>
      <MobileTabBar isAuthed={!!user && !loading} />
    </div>
  );
}
