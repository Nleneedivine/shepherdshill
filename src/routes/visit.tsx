import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Baby, Shirt, Clock, MapPin, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SERVICE_TIMES, CHURCH_ADDRESS } from "@/constants/serviceTimes";

export const Route = createFileRoute("/visit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Plan Your Visit | RCCG Shepherd's Hill" },
      {
        name: "description",
        content:
          "New to Shepherd's Hill? Here's what to expect on Sunday — service times, parking, dress code, and our children's ministry.",
      },
      { property: "og:title", content: "Plan Your Visit | RCCG Shepherd's Hill" },
      {
        property: "og:description",
        content:
          "Everything a first-time visitor needs to know about worshipping with RCCG Shepherd's Hill.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisitPage,
});

const BLOCKS = [
  {
    icon: Clock,
    title: "What to expect",
    body: "Worship runs about 90 minutes: praise, the word, and prayer. Come as you are — someone from our welcome team will meet you at the door, show you around, and sit with you if you'd like company.",
  },
  {
    icon: Shirt,
    title: "Dress code",
    body: "There isn't one. Many wear smart casual or traditional attire, others come straight from work. You will never be out of place here.",
  },
  {
    icon: Car,
    title: "Parking",
    body: "Free parking is available on site, with marshals directing traffic from 30 minutes before each service. Arrive a little early on Sundays for the easiest spot.",
  },
  {
    icon: Baby,
    title: "Children",
    body: "Children's Church runs during the main Sunday services. Every child is signed in and out by a checked worker, and you'll be notified if you're needed.",
  },
];

function VisitPage() {
  const { user, loading } = useAuth();
  const isAuthed = !!user && !loading;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0">
      <div className="max-w-3xl mx-auto px-5 pt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back home
        </Link>

        <h1 className="mt-8 text-3xl md:text-4xl font-bold tracking-tight">New here?</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          We'd love to meet you. Here's everything you need to know before your first visit to
          RCCG Shepherd's Hill.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#2EAD3F]">
            Service times
          </h2>
          <ul className="mt-4 space-y-3">
            {SERVICE_TIMES.map((s) => (
              <li key={s.time + s.day} className="flex items-baseline justify-between gap-4">
                <span className="text-foreground font-medium">
                  {s.day}
                  {s.name ? <span className="text-muted-foreground font-normal"> · {s.name}</span> : null}
                </span>
                <span className="text-muted-foreground tabular-nums">{s.time}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <MapPin size={16} className="mt-0.5 shrink-0 text-subtle" />
            <span>{CHURCH_ADDRESS}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {BLOCKS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-surface p-5">
              <b.icon size={20} className="text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="text-muted-foreground">Planning to join us? Let us know you're coming.</p>
          <Link
            to="/register"
            className="mt-4 inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-foreground"
            style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
          >
            Register
          </Link>
        </div>
      </div>

      <MobileTabBar isAuthed={isAuthed} />
    </div>
  );
}
