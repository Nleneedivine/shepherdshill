import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Facebook,
  Fingerprint,
  Flame,
  Globe2,
  Heart,
  Instagram,
  MapPin,
  Mic2,
  Twitter,
  Users2,
  Wrench,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LogoHero } from "@/components/LogoHero";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SERVICE_TIMES, CHURCH_ADDRESS } from "@/constants/serviceTimes";
import { fetchSiteContent, toEmbedUrl, type SiteContentMap } from "@/lib/siteContent";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

type Stats = { members: number; cellGroups: number; departments: number };

async function fetchStats(): Promise<Stats> {
  const [m, c, d] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("cell_groups").select("*", { count: "exact", head: true }),
    supabase
      .from("departments")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  ]);
  return {
    members: m.count ?? 0,
    cellGroups: c.count ?? 0,
    departments: d.count ?? 0,
  };
}

function LandingPage() {
  const { user, loading } = useAuth();
  const isAuthed = !!user && !loading;

  const { data: stats } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });

  const { data: content } = useQuery({
    queryKey: ["site-content"],
    queryFn: fetchSiteContent,
    staleTime: 300_000,
  });

  return (
    <div className="relative bg-background text-foreground min-h-screen overflow-x-hidden pb-16 md:pb-0">
      <Navbar isAuthed={isAuthed} />
      <Hero isAuthed={isAuthed} content={content} />
      <WelcomeVideo content={content} />
      <Gallery content={content} />
      <Features />
      <CommunityNote stats={stats} />
      <CTA isAuthed={isAuthed} />
      <Footer />
      <MobileTabBar isAuthed={isAuthed} />
    </div>
  );
}

/* ---------------- Navbar ---------------- */

function Navbar({ isAuthed }: { isAuthed: boolean }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-[68px] border-b border-border bg-background/90 backdrop-blur-md">
      <div className="h-full max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="RCCG Shepherd's Hill logo"
            className="h-9 w-9 object-contain dark:mix-blend-screen"
            
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sm md:text-base tracking-wider">SHEPHERD'S HILL</span>
            <span className="text-[10px] text-[#2EAD3F] font-semibold tracking-widest">RCCG</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          <Link
            to="/visit"
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Plan your visit
          </Link>
          <Link
            to="/sermons"
            className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sermons
          </Link>
          {isAuthed ? (
            <Link
              to="/dashboard"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ---------------- Hero ---------------- */

function Hero({
  isAuthed,
  content,
}: {
  isAuthed: boolean;
  content: SiteContentMap | undefined;
}) {
  const heroImage = content?.["hero_background_image"]?.url ?? null;

  return (
    <section className="relative px-5 pt-24 pb-14 md:pt-32 md:pb-20 overflow-hidden">
      {/* Background media or tasteful default */}
      <div aria-hidden="true" className="absolute inset-0">
        {heroImage ? (
          <>
            <img src={heroImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-background/85" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(1000px 600px at 50% -10%, rgba(45,27,142,0.28) 0%, transparent 70%)",
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="relative max-w-3xl mx-auto flex flex-col items-center text-center">
        <LogoHero />

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-7 text-3xl md:text-6xl font-black tracking-[0.12em] text-foreground"
        >
          SHEPHERD'S HILL
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-3 text-[11px] md:text-xs font-semibold uppercase tracking-[0.3em] text-[#2EAD3F]"
        >
          The Redeemed Christian Church of God
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-5 text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed"
        >
          A church family in the heart of the city — worship with us this week, and stay connected
          all week long.
        </motion.p>

        {/* Service times, above the fold */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-8 w-full rounded-2xl border border-border bg-surface p-5 text-left"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
            Service times
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {SERVICE_TIMES.map((s) => (
              <li
                key={`${s.day}-${s.time}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-surface-soft px-3.5 py-2.5"
              >
                <span className="text-sm text-foreground font-medium">
                  {s.day}
                  {s.name ? <span className="block text-xs text-muted-foreground font-normal">{s.name}</span> : null}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">{s.time}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-start gap-2 border-t border-border pt-3.5 text-xs text-muted-foreground">
            <MapPin size={14} className="mt-0.5 shrink-0 text-subtle" />
            <link>{CHURCH_ADDRESS}</link>
          </div>
        </motion.div>

        {/* CTAs */}
        <div className="mt-7 flex w-full flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={isAuthed ? "/dashboard" : "/register"}
            className="group inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
          >
            {isAuthed ? "Go to dashboard" : "Register"}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          {!isAuthed && (
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-2xl border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-surface-soft transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        <Link to="/visit" className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          New here? Plan your visit →
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Welcome video ---------------- */

function WelcomeVideo({ content }: { content: SiteContentMap | undefined }) {
  const video = content?.["welcome_video"]?.url;
  if (!video) return null;
  const embed = toEmbedUrl(video);

  return (
    <section className="px-5 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">A word of welcome</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-black aspect-video">
          {embed ? (
            <iframe
              src={embed}
              title="Welcome video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={video} controls playsInline className="h-full w-full" />
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Photo strip ---------------- */

function Gallery({ content }: { content: SiteContentMap | undefined }) {
  const photos = ["gallery_image_1", "gallery_image_2", "gallery_image_3"]
    .map((k) => content?.[k]?.url)
    .filter((u): u is string => !!u);

  if (photos.length === 0) return null;

  return (
    <section className="px-5 py-12 md:py-16 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold">Life at Shepherd's Hill</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Church life photo ${i + 1}`}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-2xl border border-border object-cover"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Features ---------------- */

const FEATURES = [
  {
    icon: Users2,
    tint: "#4A2ED4",
    title: "Member Portal",
    desc: "Your profile, spiritual journey, family records, and church history — always with you.",
  },
  {
    icon: Fingerprint,
    tint: "#CC0000",
    title: "Smart Attendance",
    desc: "Check in with your face, fingerprint or QR code. Seamless, fast and secure.",
  },
  {
    icon: Heart,
    tint: "#2EAD3F",
    title: "Online Giving",
    desc: "Tithes, offerings and seeds — give from anywhere, in any currency.",
  },
  {
    icon: Flame,
    tint: "#9333EA",
    title: "Prayer Wall",
    desc: "Submit requests, join intercession, and celebrate answered prayer together.",
  },
  {
    icon: Mic2,
    tint: "#0EA5E9",
    title: "Sermon Archive",
    desc: "Every message from Shepherd's Hill — searchable, streamable and shareable.",
  },
  {
    icon: Globe2,
    tint: "#D97706",
    title: "House Fellowship Centres",
    desc: "Stay connected to your centre, zone and parish through the week.",
  },
];

function Features() {
  return (
    <section className="px-5 py-14 md:py-20 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">Everything your church life needs</h2>
        <p className="mt-3 text-muted-foreground max-w-xl">
          One platform for the whole church family — connected, growing and thriving together.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: Math.min(i, 3) * 0.06 }}
              className="rounded-2xl border border-border bg-surface p-5 hover:border-border transition-colors"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${f.tint}1F`, border: `1px solid ${f.tint}59` }}
              >
                <f.icon size={20} style={{ color: f.tint }} aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Community note (stats only when real) ---------------- */

function CommunityNote({ stats }: { stats: Stats | undefined }) {
  const hasRealStats =
    !!stats && stats.members > 0 && stats.cellGroups > 0 && stats.departments > 0;

  return (
    <section className="px-5 py-14 md:py-20 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        {hasRealStats ? (
          <div className="grid grid-cols-3 gap-4">
            <StatItem value={stats!.members} label="Members" />
            <StatItem value={stats!.cellGroups} label="House Fellowship Centres" />
            <StatItem value={stats!.departments} label="Departments" />
          </div>
        ) : (
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            A growing family of worshippers, house fellowship centres and serving teams — and there
            is a place here for you.
          </p>
        )}
      </div>
    </section>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl md:text-4xl font-black text-foreground tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="mt-1 text-[10px] md:text-xs uppercase tracking-widest text-subtle">
        {label}
      </span>
    </div>
  );
}

/* ---------------- CTA ---------------- */

function CTA({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="px-5 py-14 md:py-20 border-t border-border">
      <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Join the Shepherd's Hill family
        </h2>
        <p className="mt-3 text-muted-foreground">
          Registration takes less than five minutes. An usher or your house fellowship coordinator
          is always ready to help.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={isAuthed ? "/dashboard" : "/register"}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2D1B8E, #CC0000)" }}
          >
            {isAuthed ? "Go to dashboard" : "Register"}
          </Link>
          {!isAuthed && (
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-2xl border border-border px-8 py-3.5 font-semibold text-foreground hover:bg-surface-soft"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="border-t border-border px-5 pt-12 pb-10">
      <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="RCCG Shepherd's Hill logo"
              className="h-12 w-12 object-contain dark:mix-blend-screen"
              
            />
            <div>
              <div className="font-bold tracking-wider text-foreground">SHEPHERD'S HILL</div>
              <div className="text-xs text-[#2EAD3F] mt-0.5">
                The Redeemed Christian Church of God
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-subtle">
            © {new Date().getFullYear()} RCCG Shepherd's Hill. All rights reserved.
          </p>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-widest text-subtle">Visit</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/visit" className="text-muted-foreground hover:text-foreground">Plan your visit</Link>
            </li>
            <li>
              <Link to="/sermons" className="text-muted-foreground hover:text-foreground">Sermon archive</Link>
            </li>
            <li>
              <Link to="/give" className="text-muted-foreground hover:text-foreground">Giving</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-widest text-subtle">Platform</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/register" className="text-muted-foreground hover:text-foreground">Register</Link>
            </li>
            <li>
              <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            </li>
            <li>
              <a
                href="https://shills.lovable.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Wrench size={14} /> Join the IT project
              </a>
            </li>
          </ul>
          <div className="mt-6 flex gap-4 text-subtle">
            <a href="#" aria-label="Facebook" className="hover:text-foreground"><Facebook size={18} /></a>
            <a href="#" aria-label="Instagram" className="hover:text-foreground"><Instagram size={18} /></a>
            <a href="#" aria-label="X" className="hover:text-foreground"><Twitter size={18} /></a>
            <a href="#" aria-label="YouTube" className="hover:text-foreground"><Youtube size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
