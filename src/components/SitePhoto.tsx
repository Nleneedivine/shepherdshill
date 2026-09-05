import { useQuery } from "@tanstack/react-query";
import { fetchSiteContent } from "@/lib/siteContent";

/**
 * A wide photo slot filled from the admin "Landing Page Content" screen.
 * Renders nothing until an admin has uploaded a picture for the key.
 */
export function SitePhoto({
  contentKey,
  alt,
  className = "",
}: {
  contentKey: string;
  alt: string;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["site-content"],
    queryFn: fetchSiteContent,
    staleTime: 300_000,
  });

  const url = data?.[contentKey]?.url;
  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`w-full rounded-2xl border border-border object-cover ${className}`}
    />
  );
}
