import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Mic2, Play, Search, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileTabBar } from "@/components/MobileTabBar";
import { fetchSermons, youtubeThumbnail } from "@/lib/sermons";

export const Route = createFileRoute("/sermons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sermon Archive | RCCG Shepherd's Hill" },
      {
        name: "description",
        content:
          "Watch and search past messages from RCCG Shepherd's Hill — Sunday services, Digging Deep and Faith Clinic.",
      },
      { property: "og:title", content: "Sermon Archive | RCCG Shepherd's Hill" },
      {
        property: "og:description",
        content: "Every message from RCCG Shepherd's Hill, in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SermonsPage,
});

function SermonsPage() {
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");

  const { data: sermons, isLoading } = useQuery({
    queryKey: ["sermons"],
    queryFn: fetchSermons,
  });

  const types = useMemo(
    () => Array.from(new Set((sermons ?? []).map((s) => s.service_type))).sort(),
    [sermons],
  );
  const years = useMemo(
    () =>
      Array.from(new Set((sermons ?? []).map((s) => s.sermon_date.slice(0, 4)))).sort().reverse(),
    [sermons],
  );

  const filtered = (sermons ?? []).filter((s) => {
    const term = q.trim().toLowerCase();
    const matchesTerm =
      !term ||
      s.title.toLowerCase().includes(term) ||
      s.preacher.toLowerCase().includes(term) ||
      s.service_type.toLowerCase().includes(term);
    const matchesType = type === "all" || s.service_type === type;
    const matchesYear = year === "all" || s.sermon_date.startsWith(year);
    return matchesTerm && matchesType && matchesYear;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-12">
      <div className="max-w-5xl mx-auto px-5 pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back home
        </Link>

        <header className="mt-8 flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
          >
            <Mic2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sermon archive</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Messages preached at Shepherd's Hill — search by title, preacher or service.
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sermons"
              aria-label="Search sermons"
              className="w-full rounded-xl border border-border bg-surface py-3 pl-9 pr-4 text-sm text-foreground placeholder:text-subtle outline-none focus:border-violet-500"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by service type"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-violet-500"
          >
            <option value="all">All services</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Filter by year"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-violet-500"
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="mt-8">
          {isLoading && <p className="text-sm text-subtle">Loading sermons…</p>}

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
              <Mic2 size={26} className="mx-auto text-subtle" />
              <p className="mt-3 text-sm text-muted-foreground">
                {sermons && sermons.length > 0
                  ? "No sermons match those filters."
                  : "No sermons have been published yet. Check back soon."}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Link
                key={s.id}
                to="/sermons/$id"
                params={{ id: s.id }}
                className="group rounded-2xl border border-border bg-surface overflow-hidden transition-colors hover:border-border"
              >
                <div className="relative aspect-video bg-black/40">
                  {s.youtube_video_id && (
                    <img
                      src={youtubeThumbnail(s.youtube_video_id)}
                      alt={`${s.title} thumbnail`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play size={30} className="text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#2EAD3F]">
                    {s.service_type}
                  </span>
                  <h2 className="mt-1 font-semibold leading-snug line-clamp-2">{s.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} /> {s.preacher}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      {new Date(s.sermon_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <MobileTabBar isAuthed={!!user && !loading} />
    </div>
  );
}
