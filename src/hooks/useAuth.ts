import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, AuthUser, Profile } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || session.user.is_anonymous) {
      setUser(null);
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: rolesRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    ]);
    setUser({
      id: session.user.id,
      email: session.user.email ?? null,
      phone: session.user.phone ?? null,
      profile: (profile as Profile | null) ?? null,
      roles: ((rolesRows ?? []) as { role: AppRole }[]).map((r) => r.role),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setLoading(true);
        void loadUser();
      }
    });
    void loadUser();
    return () => sub.subscription.unsubscribe();
  }, [loadUser]);

  const login = useCallback(async (identifier: string, password: string) => {
    const isEmail = identifier.includes("@");
    const { error } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await supabase.auth.signInWithPassword({ phone: identifier, password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, loading, login, logout, refreshProfile: loadUser };
}
