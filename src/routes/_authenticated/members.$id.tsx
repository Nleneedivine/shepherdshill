import { createFileRoute } from "@tanstack/react-router";
import { MemberProfilePage } from "@/features/members/MemberProfilePage";

export const Route = createFileRoute("/_authenticated/members/$id")({
  ssr: false,
  component: MemberProfileRoute,
});

function MemberProfileRoute() {
  const { id } = Route.useParams();
  return <MemberProfilePage memberId={id} />;
}
