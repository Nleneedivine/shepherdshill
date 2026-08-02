import { createFileRoute } from "@tanstack/react-router";
import { MemberProfilePage } from "@/features/members/MemberProfilePage";
import { requireRoles, STAFF_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/members/$id")({
  ssr: false,
  beforeLoad: () => requireRoles(STAFF_ROLES),
  component: MemberProfileRoute,
});

function MemberProfileRoute() {
  const { id } = Route.useParams();
  return <MemberProfilePage memberId={id} />;
}
