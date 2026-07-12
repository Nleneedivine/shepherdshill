import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_VALUES = 5;

// Never store these — even prefix matches are excluded.
const SENSITIVE_PATTERNS = [/password/i, /pin/i, /card/i, /cvv/i, /ssn/i, /secret/i, /token/i];

function isSensitive(key: string): boolean {
  return SENSITIVE_PATTERNS.some((r) => r.test(key));
}

export interface UseFieldMemoryReturn {
  recentValues: string[];
  saveValue: (value: string) => Promise<void>;
  clearMemory: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Field-level memory for form inputs.
 * - Authenticated: stored per user in `field_memory` (RLS scoped to auth.uid()).
 * - Anonymous: stored in localStorage as `fm_${fieldKey}`.
 * Convention for fieldKey: "formname.fieldname" (e.g. "reg.first_name").
 */
export function useFieldMemory(fieldKey: string): UseFieldMemoryReturn {
  const [recentValues, setRecentValues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSensitive(fieldKey)) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id ?? null;
        userIdRef.current = uid;
        if (uid) {
          const { data } = await supabase
            .from("field_memory" as never)
            .select("values")
            .eq("user_id" as never, uid as never)
            .eq("field_key" as never, fieldKey as never)
            .maybeSingle();
          const values = ((data as { values?: unknown } | null)?.values ?? []) as string[];
          if (!cancelled) setRecentValues(Array.isArray(values) ? values.slice(0, MAX_VALUES) : []);
        } else if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(`fm_${fieldKey}`);
          if (raw && !cancelled) {
            try {
              const parsed = JSON.parse(raw) as unknown;
              if (Array.isArray(parsed)) setRecentValues((parsed as string[]).slice(0, MAX_VALUES));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* fallback: no memory */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldKey]);

  const saveValue = useCallback(
    async (value: string) => {
      if (isSensitive(fieldKey)) return;
      const v = value?.trim();
      if (!v) return;
      const next = [v, ...recentValues.filter((x) => x !== v)].slice(0, MAX_VALUES);
      setRecentValues(next);
      try {
        const uid = userIdRef.current;
        if (uid) {
          await supabase
            .from("field_memory" as never)
            .upsert(
              { user_id: uid, field_key: fieldKey, values: next, updated_at: new Date().toISOString() } as never,
              { onConflict: "user_id,field_key" },
            );
        } else if (typeof window !== "undefined") {
          window.localStorage.setItem(`fm_${fieldKey}`, JSON.stringify(next));
        }
      } catch {
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(`fm_${fieldKey}`, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      }
    },
    [fieldKey, recentValues],
  );

  const clearMemory = useCallback(async () => {
    setRecentValues([]);
    try {
      const uid = userIdRef.current;
      if (uid) {
        await supabase
          .from("field_memory" as never)
          .delete()
          .eq("user_id" as never, uid as never)
          .eq("field_key" as never, fieldKey as never);
      } else if (typeof window !== "undefined") {
        window.localStorage.removeItem(`fm_${fieldKey}`);
      }
    } catch {
      /* ignore */
    }
  }, [fieldKey]);

  return { recentValues, saveValue, clearMemory, isLoading };
}
