import { supabase } from "@/integrations/supabase/client";

export interface Sermon {
  id: string;
  title: string;
  preacher: string;
  service_type: string;
  sermon_date: string;
  youtube_url: string;
  youtube_video_id: string | null;
  description: string | null;
  is_published: boolean;
  created_at: string;
}

export const SERVICE_TYPES = [
  "Sunday Service",
  "Digging Deep",
  "Faith Clinic",
  "Special Programme",
  "Conference",
  "Other",
] as const;

/** Pull the 11-character video ID out of any common YouTube URL shape. */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?[^#]*v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

export const youtubeEmbedUrl = (id: string) => `https://www.youtube.com/embed/${id}`;
export const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export async function fetchSermons(): Promise<Sermon[]> {
  const { data, error } = await supabase
    .from("sermons")
    .select("*")
    .order("sermon_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sermon[];
}

export async function fetchSermon(id: string): Promise<Sermon | null> {
  const { data, error } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Sermon | null) ?? null;
}

export interface SermonInput {
  title: string;
  preacher: string;
  service_type: string;
  sermon_date: string;
  youtube_url: string;
  description?: string | null;
  is_published?: boolean;
}

export async function createSermon(input: SermonInput): Promise<void> {
  const videoId = extractYouTubeId(input.youtube_url);
  if (!videoId) throw new Error("That doesn't look like a valid YouTube link.");
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("sermons").insert({
    ...input,
    description: input.description || null,
    youtube_video_id: videoId,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateSermon(id: string, input: Partial<SermonInput>): Promise<void> {
  const patch: Partial<SermonInput> & { youtube_video_id?: string } = { ...input };
  if (input.youtube_url) {
    const videoId = extractYouTubeId(input.youtube_url);
    if (!videoId) throw new Error("That doesn't look like a valid YouTube link.");
    patch.youtube_video_id = videoId;
  }
  const { error } = await supabase.from("sermons").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSermon(id: string): Promise<void> {
  const { error } = await supabase.from("sermons").delete().eq("id", id);
  if (error) throw error;
}
