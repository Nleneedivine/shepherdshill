import { createFileRoute } from "@tanstack/react-router";
import { MembersPage } from "@/features/members/MembersPage";
import { requireRoles, STAFF_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/members/")({
  ssr: false,
  beforeLoad: () => requireRoles(STAFF_ROLES),
  component: MembersPage,
});
