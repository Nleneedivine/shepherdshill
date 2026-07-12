import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_ID_KEY = "session_id";
const DRAFT_LOCAL_PREFIX = "draft_";

export interface FormDraft {
  formKey: string;
  formData: Record<string, unknown>;
  currentStep: number;
  completenessScore: number;
  lastSavedAt: Date;
}

export interface UseFormDraftReturn {
  draft: FormDraft | null;
  saveDraft: (data: Record<string, unknown>, step: number, score?: number) => Promise<void>;
  clearDraft: () => Promise<void>;
  isDraftLoading: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
}

function getAnonSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/**
 * Auto-save + resume for multi-step forms.
 * Stored in Supabase `form_drafts` (30-day expiry) with localStorage fallback.
 * Anonymous drafts identified by a browser-local session_id.
 */
export function useFormDraft(formKey: string): UseFormDraftReturn {
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id ?? null;
        userIdRef.current = uid;
        sessionIdRef.current = uid ? "" : getAnonSessionId();

        let query = supabase
          .from("form_drafts" as never)
          .select("form_data, current_step, completeness_score, last_saved_at, expires_at")
          .eq("form_key" as never, formKey as never)
          .maybeSingle();

        if (uid) query = supabase.from("form_drafts" as never)
          .select("form_data, current_step, completeness_score, last_saved_at, expires_at")
          .eq("user_id" as never, uid as never)
          .eq("form_key" as never, formKey as never)
          .maybeSingle();
        else if (sessionIdRef.current) query = supabase.from("form_drafts" as never)
          .select("form_data, current_step, completeness_score, last_saved_at, expires_at")
          .eq("session_id" as never, sessionIdRef.current as never)
          .eq("form_key" as never, formKey as never)
          .maybeSingle();

        const { data } = await query;
        const row = data as {
          form_data?: Record<string, unknown>;
          current_step?: number;
          completeness_score?: number;
          last_saved_at?: string;
          expires_at?: string;
        } | null;

        if (row && row.expires_at && new Date(row.expires_at) > new Date()) {
          if (!cancelled) setDraft({
            formKey,
            formData: row.form_data ?? {},
            currentStep: row.current_step ?? 0,
            completenessScore: row.completeness_score ?? 0,
            lastSavedAt: new Date(row.last_saved_at ?? Date.now()),
          });
        } else if (typeof window !== "undefined") {
          // Fallback to localStorage
          const raw = window.localStorage.getItem(`${DRAFT_LOCAL_PREFIX}${formKey}`);
          if (raw && !cancelled) {
            try {
              const parsed = JSON.parse(raw) as {
                formData: Record<string, unknown>;
                currentStep: number;
                completenessScore: number;
                lastSavedAt: string;
              };
              setDraft({
                formKey,
                formData: parsed.formData,
                currentStep: parsed.currentStep,
                completenessScore: parsed.completenessScore,
                lastSavedAt: new Date(parsed.lastSavedAt),
              });
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* graceful */
      } finally {
        if (!cancelled) setIsDraftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formKey]);

  const persist = useCallback(
    async (data: Record<string, unknown>, step: number, score: number) => {
      const now = new Date();
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      const payload = {
        form_key: formKey,
        form_data: data,
        current_step: step,
        completeness_score: score,
        last_saved_at: now.toISOString(),
        expires_at: expires.toISOString(),
        ...(uid ? { user_id: uid } : { session_id: sid }),
      };

      // localStorage backup first (always succeeds; used by beforeunload)
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            `${DRAFT_LOCAL_PREFIX}${formKey}`,
            JSON.stringify({ formData: data, currentStep: step, completenessScore: score, lastSavedAt: now.toISOString() }),
          );
        } catch {
          /* ignore */
        }
      }

      try {
        await supabase
          .from("form_drafts" as never)
          .upsert(payload as never, {
            onConflict: uid ? "user_id,form_key" : "session_id,form_key",
          });
      } catch {
        /* localStorage already saved above */
      }
      setLastSaved(now);
    },
    [formKey],
  );

  const saveDraft = useCallback(
    (data: Record<string, unknown>, step: number, score = 0) => {
      setIsSaving(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      return new Promise<void>((resolve) => {
        saveTimerRef.current = setTimeout(async () => {
          try {
            await persist(data, step, score);
          } finally {
            setIsSaving(false);
            resolve();
          }
        }, 500);
      });
    },
    [persist],
  );

  const clearDraft = useCallback(async () => {
    setDraft(null);
    setLastSaved(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${DRAFT_LOCAL_PREFIX}${formKey}`);
    }
    try {
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      let q = supabase.from("form_drafts" as never).delete().eq("form_key" as never, formKey as never);
      if (uid) q = q.eq("user_id" as never, uid as never);
      else if (sid) q = q.eq("session_id" as never, sid as never);
      await q;
    } catch {
      /* ignore */
    }
  }, [formKey]);

  return { draft, saveDraft, clearDraft, isDraftLoading, lastSaved, isSaving };
}
