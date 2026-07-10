import { createFileRoute } from "@tanstack/react-router";
import { MembersPage } from "@/features/members/MembersPage";

export const Route = createFileRoute("/_authenticated/members")({
  ssr: false,
  component: MembersPage,
});
