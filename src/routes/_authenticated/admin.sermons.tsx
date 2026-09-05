import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Youtube } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Button, Card, Input, Select, Textarea } from "@/components/ds";
import { useToast } from "@/hooks/useToast";
import { requireSermonManager } from "@/lib/routeGuards";
import {
  SERVICE_TYPES,
  createSermon,
  deleteSermon,
  extractYouTubeId,
  fetchSermons,
  youtubeThumbnail,
} from "@/lib/sermons";

export const Route = createFileRoute("/_authenticated/admin/sermons")({
  ssr: false,
  beforeLoad: () => requireSermonManager(),
  component: SermonsAdminPage,
});

const EMPTY = {
  title: "",
  preacher: "",
  service_type: SERVICE_TYPES[0] as string,
  sermon_date: new Date().toISOString().slice(0, 10),
  youtube_url: "",
  description: "",
};

function SermonsAdminPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data: sermons } = useQuery({ queryKey: ["sermons"], queryFn: fetchSermons });

  const previewId = extractYouTubeId(form.youtube_url);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!form.title.trim() || !form.preacher.trim() || !form.youtube_url.trim()) {
      showToast("Title, preacher and YouTube link are required", "error");
      return;
    }
    setBusy(true);
    try {
      await createSermon(form);
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["sermons"] });
      showToast("Sermon added", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not add sermon", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteSermon(id);
      void qc.invalidateQueries({ queryKey: ["sermons"] });
      showToast("Sermon removed", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not remove sermon", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Sermons"
      crumb="Sermons"
      description="Add YouTube messages to the public sermon archive."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title="Add a sermon" subtitle="Paste the full YouTube link for the message.">
          <div className="space-y-4">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="The Power of Consistent Prayer"
            />
            <Input
              label="Preacher"
              required
              value={form.preacher}
              onChange={(e) => set("preacher", e.target.value)}
              placeholder="Pastor John Doe"
            />
            <Select
              label="Service"
              value={form.service_type}
              onChange={(e) => set("service_type", e.target.value)}
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Input
              label="Date"
              type="date"
              value={form.sermon_date}
              onChange={(e) => set("sermon_date", e.target.value)}
            />
            <Input
              label="YouTube link"
              required
              value={form.youtube_url}
              onChange={(e) => set("youtube_url", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              error={
                form.youtube_url && !previewId ? "That link doesn't look like a YouTube video" : undefined
              }
            />
            <Textarea
              label="Description (optional)"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />

            {previewId && (
              <img
                src={youtubeThumbnail(previewId)}
                alt="Video preview"
                className="w-full rounded-xl border border-white/10 object-cover"
              />
            )}

            <Button disabled={busy} onClick={() => void handleSubmit()}>
              <Plus size={16} /> Add sermon
            </Button>
          </div>
        </Card>

        <Card title="Published sermons" subtitle={`${sermons?.length ?? 0} in the archive`}>
          {(!sermons || sermons.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
              <Youtube size={26} />
              <span className="text-sm">Nothing added yet.</span>
            </div>
          )}
          <ul className="divide-y divide-white/5">
            {(sermons ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                {s.youtube_video_id && (
                  <img
                    src={youtubeThumbnail(s.youtube_video_id)}
                    alt=""
                    className="h-12 w-20 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{s.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {s.preacher} · {s.service_type} · {s.sermon_date}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void handleDelete(s.id)}
                  aria-label={`Remove ${s.title}`}
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
