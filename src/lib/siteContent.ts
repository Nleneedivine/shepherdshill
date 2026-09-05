import { supabase } from "@/integrations/supabase/client";

export const SITE_MEDIA_BUCKET = "site-media";

/** Ten years, in seconds — signed URLs for publicly displayed landing media. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export interface SiteContentBlockDef {
  key: string;
  label: string;
  description: string;
  contentType: "image" | "video";
  /** Allow pasting an embeddable URL instead of uploading a file. */
  allowUrl: boolean;
  accept: string;
}

export const SITE_CONTENT_BLOCKS: SiteContentBlockDef[] = [
  {
    key: "hero_background_image",
    label: "Hero background image",
    description:
      "Shown behind the landing page hero. Wide, dark images work best (1920×1080 or larger).",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "welcome_video",
    label: "Welcome video",
    description:
      "A short welcome message. Paste a YouTube/Vimeo link or upload an MP4.",
    contentType: "video",
    allowUrl: true,
    accept: "video/*",
  },
  {
    key: "gallery_image_1",
    label: "Church life photo 1",
    description: "Shown in the photo strip on the home page.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "gallery_image_2",
    label: "Church life photo 2",
    description: "Shown in the photo strip on the home page.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "gallery_image_3",
    label: "Church life photo 3",
    description: "Shown in the photo strip on the home page.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "visit_image",
    label: "Plan your visit photo",
    description: "A wide photo at the top of the 'Plan your visit' page.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "give_image",
    label: "Giving page photo",
    description: "A wide photo at the top of the giving page.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
  {
    key: "sermons_banner",
    label: "Sermon archive banner",
    description: "A wide photo at the top of the sermon archive.",
    contentType: "image",
    allowUrl: false,
    accept: "image/*",
  },
];

export type SiteContentMap = Record<string, { url: string; content_type: string }>;

export async function fetchSiteContent(): Promise<SiteContentMap> {
  const { data, error } = await supabase
    .from("site_content")
    .select("key, url, content_type");
  if (error) return {};
  const map: SiteContentMap = {};
  for (const row of (data ?? []) as { key: string; url: string | null; content_type: string }[]) {
    if (row.url) map[row.key] = { url: row.url, content_type: row.content_type };
  }
  return map;
}

export async function uploadSiteMedia(key: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${key}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Could not create media link");
  return data.signedUrl;
}

export async function saveSiteContent(
  key: string,
  contentType: string,
  url: string | null,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("site_content")
    .upsert(
      { key, content_type: contentType, url, updated_by: userData.user?.id ?? null },
      { onConflict: "key" },
    );
  if (error) throw error;
}

/** Turn a YouTube/Vimeo watch link into an embeddable URL. Returns null for direct files. */
export function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
