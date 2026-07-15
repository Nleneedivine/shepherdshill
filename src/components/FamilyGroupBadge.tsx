import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  memberId: string;
  showScheme?: boolean;
  size?: "sm" | "md" | "lg";
}

interface GroupInfo {
  name: string;
  emoji: string | null;
  colour: string | null;
  short_name: string | null;
  min_age: number | null;
  max_age: number | null;
  scheme_name: string;
}

export function FamilyGroupBadge({ memberId, showScheme = false, size = "md" }: Props) {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("member_family_groups")
        .select("family_groups(name, emoji, colour, short_name, min_age, max_age), family_grouping_schemes(name)")
        .eq("member_id", memberId)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      const row = data as unknown as {
        family_groups: { name: string; emoji: string | null; colour: string | null; short_name: string | null; min_age: number | null; max_age: number | null } | null;
        family_grouping_schemes: { name: string } | null;
      } | null;
      if (row?.family_groups && row.family_grouping_schemes) {
        setGroup({
          ...row.family_groups,
          scheme_name: row.family_grouping_schemes.name,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  if (loading) {
    return <div className="inline-block h-6 w-24 rounded-full bg-white/5 animate-pulse" />;
  }

  if (!group) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
        Not yet assigned
      </span>
    );
  }

  const colour = group.colour || "#6366f1";
  const sizeCls =
    size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" :
    size === "lg" ? "px-3.5 py-1.5 text-sm gap-2" :
    "px-2.5 py-1 text-xs gap-1.5";

  const ageLabel = group.min_age != null
    ? group.max_age != null ? `${group.min_age}–${group.max_age}` : `${group.min_age}+`
    : null;

  return (
    <div className="inline-flex flex-col items-start">
      <span
        className={`inline-flex items-center rounded-full border font-medium ${sizeCls}`}
        style={{
          backgroundColor: `${colour}26`,
          borderColor: `${colour}66`,
          color: colour,
        }}
      >
        {group.emoji && <span className="not-italic">{group.emoji}</span>}
        <span>{group.name}</span>
        {size === "lg" && ageLabel && <span className="opacity-70">· {ageLabel}</span>}
      </span>
      {showScheme && (
        <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
          {group.scheme_name}
        </span>
      )}
    </div>
  );
}
