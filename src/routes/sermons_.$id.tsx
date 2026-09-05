import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ExternalLink, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileTabBar } from "@/components/MobileTabBar";
import { fetchSermon, youtubeEmbedUrl } from "@/lib/sermons";

export const Route = createFileRoute("/sermons_/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sermon | RCCG Shepherd's Hill" },
      {
        name: "description",
        content: "Watch this message from RCCG Shepherd's Hill.",
      },
      { property: "og:title", content: "Sermon | RCCG Shepherd's Hill" },
      {
        property: "og:description",
        content: "Watch this message from RCCG Shepherd's Hill.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SermonDetailPage,
});

function SermonDetailPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const { data: sermon, isLoading } = useQuery({
    queryKey: ["sermon", id],
    queryFn: () => fetchSermon(id),
  });

  return (
    <div className="min-h-screen bg-[#080C16] text-white pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto px-5 pt-10">
        <Link
          to="/sermons"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} /> All sermons
        </Link>

        {isLoading && <p className="mt-10 text-sm text-slate-500">Loading…</p>}

        {!isLoading && !sermon && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#0D1117] p-10 text-center text-sm text-slate-400">
            That sermon could not be found.
          </div>
        )}

        {sermon && (
          <article className="mt-8">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black aspect-video">
              {sermon.youtube_video_id ? (
                <iframe
                  src={youtubeEmbedUrl(sermon.youtube_video_id)}
                  title={sermon.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Video unavailable
                </div>
              )}
            </div>

            <span className="mt-6 inline-block text-[10px] font-semibold uppercase tracking-widest text-[#2EAD3F]">
              {sermon.service_type}
            </span>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold">{sermon.title}</h1>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} /> {sermon.preacher}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                {new Date(sermon.sermon_date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <a
                href={sermon.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <ExternalLink size={14} /> Watch on YouTube
              </a>
            </div>

            {sermon.description && (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {sermon.description}
              </p>
            )}
          </article>
        )}
      </div>
      <MobileTabBar isAuthed={!!user && !loading} />
    </div>
  );
}
