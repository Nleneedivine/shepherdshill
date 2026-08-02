import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [
      { title: "Access restricted | Shepherd's Hill" },
      {
        name: "description",
        content:
          "You do not have permission to view this page of the Shepherd's Hill church console.",
      },
      { property: "og:title", content: "Access restricted | Shepherd's Hill" },
      {
        property: "og:description",
        content: "This area of the church console is limited to authorised staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#080C16]">
      <div className="max-w-md w-full text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center">
          <ShieldAlert size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-semibold text-white">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your account doesn&apos;t have permission to view this page. If you believe this is a
          mistake, ask a church administrator to update your role.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
