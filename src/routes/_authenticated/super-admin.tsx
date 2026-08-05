import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRoles, SUPER_ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  // user_roles is the single source of truth for access; the guard is
  // hierarchy-aware and reads roles through a security-definer RPC so it can
  // never be blocked by row-level read policies.
  beforeLoad: () => requireRoles(SUPER_ADMIN_ROLES, "/unauthorized"),
  component: () => <Outlet />,
});
