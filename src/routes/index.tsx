import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView, useScroll, useTransform, useReducedMotion, animate as fmAnimate } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Facebook,
  Fingerprint,
  Flame,
  Globe2,
  Heart,
  Instagram,
  Mic2,
  Twitter,
  UserPlus,
  Users2,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LogoHero } from "@/components/LogoHero";

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

function useIsMobileClient() {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const check = () => setIs(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return is;
}

function LandingPage() {
  const { user, loading } = useAuth();
  const isAuthed = !!user && !loading;

  const { data: stats } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });

  return (
    <div className="relative bg-[#080C16] text-white min-h-screen overflow-x-hidden">
      <Navbar isAuthed={isAuthed} />
      <Hero isAuthed={isAuthed} stats={stats} />
      <Features />
      <CTA stats={stats} />
      <Footer />
    </div>
  );
}

/* ---------------- Navbar ---------------- */

function Navbar({ isAuthed }: { isAuthed: boolean }) {
  return (
    <motion.nav
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 h-[72px] backdrop-blur-xl border-b border-white/[0.08]"
      style={{ background: "rgba(8, 12, 22, 0.8)" }}
    >
      <div className="h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Shepherd's Hill RCCG Logo"
            className="h-10 w-10 object-contain mix-blend-screen"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-base md:text-lg text-white tracking-wider">
              SHEPHERD'S HILL
            </span>
            <span className="text-[10px] text-[#2EAD3F] font-semibold tracking-widest">
              RCCG
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {isAuthed ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 md:px-5 py-2 rounded-xl font-semibold text-white text-sm md:text-base transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #2D1B8E, #CC0000)",
              }}
            >
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden sm:inline-flex text-slate-300 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center px-4 md:px-5 py-2 rounded-xl font-semibold text-white text-sm md:text-base transition-transform hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #2D1B8E, #CC0000)",
                }}
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

/* ---------------- Hero ---------------- */

function Hero({
  isAuthed,
  stats,
}: {
  isAuthed: boolean;
  stats: Stats | undefined;
}) {
  const isMobile = useIsMobileClient();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const scrollOpacity = useTransform(scrollY, [0, 100], [1, 0]);

  const particles = useMemo(() => {
    const count = isMobile ? 25 : 50;
    const colors = [
      "rgba(196,181,253,",
      "rgba(252,165,165,",
      "rgba(134,239,172,",
      "rgba(255,255,255,",
    ];
    return Array.from({ length: count }).map((_, i) => {
      const color = colors[i % colors.length];
      const opacity = 0.2 + Math.random() * 0.3;
      const size = 2 + Math.random() * 4;
      return {
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size,
        color: `${color}${opacity})`,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 8,
        rise: 100 + Math.random() * 200,
        peak: 0.3 + Math.random() * 0.4,
      };
    });
  }, [isMobile]);

  const church = "SHEPHERD'S HILL";

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-28 pb-16 overflow-hidden">
      {/* Orbs */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div
          className="absolute"
          style={{
            top: -150,
            left: -100,
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(45,27,142,0.25) 0%, transparent 70%)",
            filter: `blur(${isMobile ? 60 : 80}px)`,
            animation: "orbFloat1 12s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: -100,
            right: -100,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(204,0,0,0.15) 0%, transparent 70%)",
            filter: `blur(${isMobile ? 60 : 80}px)`,
            animation: "orbFloat2 10s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "33%",
            right: "25%",
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(26,122,42,0.1) 0%, transparent 70%)",
            filter: `blur(${isMobile ? 50 : 60}px)`,
            animation: "orbFloat3 14s ease-in-out infinite alternate",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "33%",
            left: "25%",
            width: 350,
            height: 350,
            background:
              "radial-gradient(circle, rgba(74,46,212,0.2) 0%, transparent 70%)",
            filter: `blur(${isMobile ? 55 : 70}px)`,
            animation: "orbFloat4 11s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Dot grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Particles */}
      {!reduce && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              animate={{
                y: [0, -p.rise],
                opacity: [0, p.peak, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <LogoHero />

        <motion.h1
          className="mt-8 font-black tracking-widest text-4xl md:text-7xl lg:text-8xl bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #FFFFFF 0%, #C4B5FD 30%, #FFFFFF 60%, #FCA5A5 100%)",
          }}
          aria-label={church}
        >
          {church.split("").map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.04, duration: 0.4 }}
              className="inline-block"
            >
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </motion.h1>

        <motion.div
          className="mt-6 flex items-center gap-4 max-w-xl w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#1A7A2A]/50" />
          <span className="text-[10px] md:text-sm font-semibold tracking-[0.3em] uppercase text-[#2EAD3F] whitespace-nowrap">
            The Redeemed Christian Church of God
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#1A7A2A]/50" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 0.6 }}
          className="text-xl md:text-2xl text-slate-300 mt-6 font-light italic"
        >
          Where Faith Meets Community
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 0.6 }}
          className="text-sm md:text-base text-slate-500 mt-3 max-w-xl leading-relaxed px-4"
        >
          Your complete digital church platform — membership, giving, sermons,
          prayer, and community in one place.
        </motion.p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 3.2,
              type: "spring",
              stiffness: 120,
              damping: 12,
            }}
          >
            <Link
              to={isAuthed ? "/dashboard" : "/register"}
              className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto font-bold text-white text-lg rounded-2xl transition-all"
              style={{
                background: "linear-gradient(135deg, #2D1B8E, #CC0000)",
                padding: "16px 40px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 40px rgba(45,27,142,0.5), 0 0 20px rgba(204,0,0,0.3)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {isAuthed ? "Go to Dashboard" : "Register Now"}
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </motion.div>

          {!isAuthed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 3.4,
                type: "spring",
                stiffness: 120,
                damping: 12,
              }}
            >
              <Link
                to="/auth"
                className="inline-flex items-center justify-center w-full sm:w-auto bg-white/[0.08] border border-white/20 text-white font-semibold px-10 py-4 rounded-2xl text-lg backdrop-blur-sm hover:bg-white/[0.12] hover:border-white/30 transition-colors"
              >
                Sign In
              </Link>
            </motion.div>
          )}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5, duration: 0.6 }}
          className="mt-14 grid grid-cols-3 sm:flex gap-6 md:gap-16 justify-center items-center"
        >
          <StatItem value={stats?.members ?? 0} label="Members" delay={3.5} />
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          <StatItem
            value={stats?.cellGroups ?? 0}
            label="House Fellowship Centres"
            delay={3.7}
          />
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          <StatItem
            value={stats?.departments ?? 0}
            label="Departments"
            delay={3.9}
          />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        style={{ opacity: scrollOpacity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
        aria-hidden="true"
      >
        <span className="text-xs text-slate-600">Discover more</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="text-slate-600" size={20} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function StatItem({
  value,
  label,
  delay,
  color,
  large,
}: {
  value: number;
  label: string;
  delay?: number;
  color?: string;
  large?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = fmAnimate(0, value, {
      duration: 1.5,
      delay: delay ?? 0,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, delay]);

  return (
    <div className="flex flex-col items-center">
      <span
        ref={ref}
        className={`${large ? "text-4xl md:text-5xl font-black" : "text-2xl md:text-3xl font-bold"} ${color ?? "text-white"}`}
      >
        {display.toLocaleString()}
      </span>
      <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

/* ---------------- Features ---------------- */

const FEATURES = [
  {
    icon: Users2,
    gradient: "linear-gradient(135deg, #2D1B8E, #4A2ED4)",
    glow: "rgba(45,27,142,0.5)",
    title: "Member Portal",
    desc: "Your profile, spiritual journey, family records, and complete church history — always with you.",
  },
  {
    icon: Fingerprint,
    gradient: "linear-gradient(135deg, #CC0000, #FF6B6B)",
    glow: "rgba(204,0,0,0.5)",
    title: "Smart Attendance",
    desc: "Check in with your face, fingerprint, QR code, or voice. Seamless, fast, and always secure.",
  },
  {
    icon: Heart,
    gradient: "linear-gradient(135deg, #1A7A2A, #2EAD3F)",
    glow: "rgba(26,122,42,0.5)",
    title: "Online Giving",
    desc: "Tithes, offerings, and seeds — give from anywhere in the world, in any currency.",
  },
  {
    icon: Flame,
    gradient: "linear-gradient(135deg, #9333EA, #C026D3)",
    glow: "rgba(147,51,234,0.5)",
    title: "Prayer Wall",
    desc: "Submit requests, join intercession chains, and celebrate every answered prayer together.",
  },
  {
    icon: Mic2,
    gradient: "linear-gradient(135deg, #0284C7, #0EA5E9)",
    glow: "rgba(2,132,199,0.5)",
    title: "Sermon Archive",
    desc: "Every message from Shepherd's Hill — searchable, streamable, and shareable. Forever.",
  },
  {
    icon: Globe2,
    gradient: "linear-gradient(135deg, #B45309, #D97706)",
    glow: "rgba(180,83,9,0.5)",
    title: "House Fellowship Centres & Community",
    desc: "Stay connected to your House Fellowship Centre, zone, and parish. The church that prays together stays together.",
  },
];

function Features() {
  return (
    <section
      className="relative py-24 md:py-32 px-6"
      style={{
        background: "linear-gradient(180deg, #080C16 0%, #0A0D1A 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span
            className="inline-block text-xs font-semibold tracking-widest px-4 py-1.5 rounded-full bg-clip-text text-transparent"
            style={{
              background:
                "linear-gradient(135deg, rgba(45,27,142,0.3), rgba(204,0,0,0.2))",
              border: "1px solid rgba(45,27,142,0.4)",
              color: "#C4B5FD",
              WebkitBackgroundClip: "padding-box",
              backgroundClip: "padding-box",
            }}
          >
            THE PLATFORM
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-4">
            Everything Your Church Life Needs
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mt-4">
            One platform. Your entire church family — connected, growing, and
            thriving together.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/25 rounded-2xl p-6 transition-all duration-300"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300"
                style={{
                  background: f.gradient,
                  boxShadow: `0 8px 20px ${f.glow.replace("0.5", "0.3")}`,
                }}
              >
                <f.icon className="text-white" size={24} aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */

function CTA({ stats }: { stats: Stats | undefined }) {
  return (
    <section className="relative overflow-hidden py-24 md:py-28 px-6">
      <div
        className="absolute inset-0"
        style={{ background: "#0A0D1A" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(45,27,142,0.2) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />
      {/* Dove silhouette */}
      <svg
        aria-hidden="true"
        className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 rotate-12 pointer-events-none"
        viewBox="0 0 100 100"
        fill="white"
        style={{ opacity: 0.04 }}
      >
        <path d="M50 20 C 30 25, 15 40, 20 55 C 25 45, 35 42, 45 45 L 40 60 C 35 65, 30 68, 25 72 C 35 70, 45 68, 52 62 C 60 68, 70 72, 82 72 C 72 65, 65 58, 60 50 C 68 45, 78 42, 88 45 C 82 35, 70 25, 55 22 Z" />
      </svg>

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="flex gap-3 justify-center flex-wrap">
          <Pill bg="#2D1B8E" text="#C4B5FD" label="🕊️ RCCG" />
          <Pill bg="#CC0000" text="#FCA5A5" label="✝️ FAITH" />
          <Pill bg="#1A7A2A" text="#86EFAC" label="🌿 COMMUNITY" />
        </div>

        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-white mt-6"
        >
          Join the Shepherd's Hill Digital Family
        </motion.h2>

        <p className="text-lg text-slate-300 mt-4">
          Registration takes less than 5 minutes.
          <br />
          Your cell leader or an usher is always ready to help you.
        </p>

        <div className="flex gap-6 md:gap-12 justify-center flex-wrap mt-10 items-center">
          <StatItem
            value={stats?.members ?? 0}
            label="Members"
            color="text-[#C4B5FD]"
            large
          />
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <StatItem
            value={stats?.cellGroups ?? 0}
            label="House Fellowship Centres"
            color="text-[#FCA5A5]"
            large
          />
          <div className="hidden md:block w-px h-12 bg-white/10" />
          <StatItem
            value={stats?.departments ?? 0}
            label="Departments"
            color="text-[#86EFAC]"
            large
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 140, damping: 12 }}
          className="mt-12 inline-block"
        >
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-3 font-bold text-white text-xl rounded-2xl transition-all"
            style={{
              background: "linear-gradient(135deg, #2D1B8E, #CC0000)",
              padding: "20px 64px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 30px rgba(45,27,142,0.5), 0 0 60px rgba(204,0,0,0.2)";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <UserPlus size={22} />
            Register Now — It's Free
          </Link>
        </motion.div>

        <p className="text-slate-500 mt-6">
          Already a member?{" "}
          <Link
            to="/auth"
            className="font-semibold bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #C4B5FD, #FCA5A5)",
            }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </section>
  );
}

function Pill({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
      style={{
        background: `${bg}33`,
        border: `1px solid ${bg}80`,
        color: text,
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer
      className="relative pt-16 pb-10 px-6"
      style={{
        background: "rgba(0,0,0,0.4)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Shepherd's Hill RCCG Logo"
              className="h-14 w-14 object-contain mix-blend-screen"
              style={{ mixBlendMode: "screen" }}
            />
            <div>
              <div className="font-bold text-white text-lg tracking-wider">
                SHEPHERD'S HILL
              </div>
              <div className="text-xs text-[#2EAD3F] mt-1">
                The Redeemed Christian Church of God
              </div>
            </div>
          </div>
          <div className="w-16 h-0.5 bg-[#1A7A2A] mt-3" />
          <p className="text-xs text-slate-600 mt-6">
            © 2024 Shepherd's Hill. All rights reserved.
          </p>
        </div>

        <div>
          <h4 className="uppercase tracking-widest text-xs text-slate-600 mb-4">
            Platform
          </h4>
          <ul className="flex flex-col gap-3 text-sm">
            <li>
              <Link
                to="/register"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Register
              </Link>
            </li>
            <li>
              <Link
                to="/auth"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
            </li>
            <li>
              <Link
                to="/auth"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Member Portal
              </Link>
            </li>
            <li>
              <Link
                to="/register"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Give Online
              </Link>
            </li>
            <li>
              <a
                href="#"
                className="text-slate-400 hover:text-white transition-colors"
              >
                Prayer Wall
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="uppercase tracking-widest text-xs text-slate-600 mb-4">
            Connect
          </h4>
          <p className="text-slate-400 text-sm">
            Shepherd's Hill Parish
            <br />
            Address coming soon
          </p>
          <div className="text-slate-500 text-xs mt-2 leading-relaxed">
            <div>Sunday: 8:00 AM & 10:00 AM</div>
            <div>Tuesday (Digging Deep): 6:00 PM</div>
            <div>Thursday (Faith Clinic): 6:00 PM</div>
          </div>
          <div className="flex gap-2 mt-4">
            {[
              { Icon: Youtube, label: "YouTube" },
              { Icon: Facebook, label: "Facebook" },
              { Icon: Instagram, label: "Instagram" },
              { Icon: Twitter, label: "Twitter" },
            ].map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-[#2D1B8E]/60 hover:bg-[#2D1B8E]/20 transition-all"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/5 text-center text-xs text-slate-700">
        Built with love for the body of Christ 🕊️
      </div>
    </footer>
  );
}
