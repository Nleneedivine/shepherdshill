import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload, Video } from "lucide-react";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card, Button, Input } from "@/components/ds";
import { useToast } from "@/hooks/useToast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";
import {
  SITE_CONTENT_BLOCKS,
  fetchSiteContent,
  saveSiteContent,
  uploadSiteMedia,
  toEmbedUrl,
  type SiteContentBlockDef,
} from "@/lib/siteContent";

export const Route = createFileRoute("/_authenticated/super-admin/content")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: ContentPage,
});

function ContentPage() {
  const { data: content } = useQuery({
    queryKey: ["site-content-admin"],
    queryFn: fetchSiteContent,
  });

  return (
    <SuperAdminShell>
      <h1 className="text-2xl font-bold text-white mb-1">Landing Page Content</h1>
      <p className="text-sm text-slate-400 mb-6">
        Upload or replace the media shown on the public landing page. Changes go live immediately.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {SITE_CONTENT_BLOCKS.map((block) => (
          <BlockEditor key={block.key} block={block} current={content?.[block.key]?.url ?? null} />
        ))}
      </div>
    </SuperAdminShell>
  );
}

function BlockEditor({
  block,
  current,
}: {
  block: SiteContentBlockDef;
  current: string | null;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["site-content-admin"] });
    void qc.invalidateQueries({ queryKey: ["site-content"] });
  };

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const url = await uploadSiteMedia(block.key, file);
      await saveSiteContent(block.key, block.contentType, url);
      refresh();
      showToast(`${block.label} updated`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleLink() {
    if (!linkValue.trim()) return;
    setBusy(true);
    try {
      await saveSiteContent(block.key, block.contentType, linkValue.trim());
      setLinkValue("");
      refresh();
      showToast(`${block.label} updated`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save link", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await saveSiteContent(block.key, block.contentType, null);
      refresh();
      showToast(`${block.label} cleared`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not clear", "error");
    } finally {
      setBusy(false);
    }
  }

  const embed = current ? toEmbedUrl(current) : null;

  return (
    <Card title={block.label} subtitle={block.description}>
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden aspect-video flex items-center justify-center">
        {!current && (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            {block.contentType === "video" ? <Video size={28} /> : <ImageIcon size={28} />}
            <span className="text-xs">Nothing set — the site uses its default</span>
          </div>
        )}
        {current && block.contentType === "image" && (
          <img src={current} alt={block.label} className="h-full w-full object-cover" />
        )}
        {current && block.contentType === "video" && embed && (
          <iframe
            src={embed}
            title={block.label}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
        {current && block.contentType === "video" && !embed && (
          <video src={current} controls className="h-full w-full" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={block.accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          {current ? "Replace file" : "Upload file"}
        </Button>
        {current && (
          <Button variant="ghost" disabled={busy} onClick={() => void handleClear()}>
            <Trash2 size={16} />
            Clear
          </Button>
        )}
      </div>

      {block.allowUrl && (
        <div className="mt-4 flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Or paste a video link"
              placeholder="https://youtube.com/watch?v=..."
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
            />
          </div>
          <Button disabled={busy || !linkValue.trim()} onClick={() => void handleLink()}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
