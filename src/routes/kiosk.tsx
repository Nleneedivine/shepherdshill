import { createFileRoute } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { Camera, Fingerprint, Mic, QrCode, Search } from "lucide-react";
import { Input, Button } from "@/components/ds";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  component: KioskPage,
});

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 15 });
  const rounded = useTransform(spring, (v) => Math.round(v).toString());
  useEffect(() => { mv.set(value); }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

function Zone({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col overflow-hidden"
    >
      <h3 className="text-sm uppercase tracking-widest text-slate-400 mb-4">{title}</h3>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">{children}</div>
    </motion.div>
  );
}

function FingerprintZone() {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_FINGERPRINT_MICROSERVICE_URL as string | undefined;
    if (!url) { setConnected(false); return; }
    const check = async () => {
      try {
        const res = await fetch(`${url}/health`, { method: "GET" });
        setConnected(res.ok);
      } catch { setConnected(false); }
    };
    void check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
        <Fingerprint size={80} className="text-violet-400" />
      </motion.div>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-slate-300">{connected ? "Place finger on scanner" : "Scanner disconnected"}</span>
      </div>
    </>
  );
}

function KioskPage() {
  const now = useClock();
  const [checkins] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen w-full text-white overflow-hidden" style={{ backgroundColor: "#080c16" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-96 w-96 rounded-full bg-violet-600 opacity-15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-96 w-96 rounded-full bg-blue-600 opacity-15 blur-3xl" />
      </div>

      <div className="relative flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
          <div>
            <div className="text-xl font-semibold">Grace Church</div>
            <div className="text-xs text-slate-400">Sunday Service</div>
          </div>
          <div className="text-3xl font-mono tabular-nums">{now.toLocaleTimeString()}</div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Members today</div>
            <div className="text-2xl font-semibold"><AnimatedCount value={checkins} /></div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
          <Zone title="Face Recognition" delay={0.1}>
            <div className="relative w-full aspect-video bg-black/50 border-2 border-violet-500/50 rounded-2xl overflow-hidden flex items-center justify-center">
              <Camera size={64} className="text-slate-600" />
              <motion.div
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent"
                animate={{ y: ["0%", "10000%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <p className="text-sm text-slate-300">Looking for faces…</p>
          </Zone>

          <Zone title="Fingerprint" delay={0.2}>
            <FingerprintZone />
          </Zone>

          <Zone title="QR Code" delay={0.3}>
            <QrCode size={64} className="text-violet-400" />
            <p className="text-sm text-slate-300">Scan Member QR Code</p>
            <Button variant="secondary">Activate camera</Button>
            <div className="w-full max-w-sm">
              <Input
                placeholder="Or enter member code manually"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>
            <Button size="sm" disabled={!manualCode}>Check in</Button>
          </Zone>

          <Zone title="Manual Search" delay={0.4}>
            <div className="w-full max-w-md space-y-3">
              <div className="relative">
                <Input
                  placeholder="Search by name or member ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search size={16} />}
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-400">
                  <Mic size={18} />
                </button>
              </div>
              {searchQuery && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-400">
                  Start typing to see suggestions…
                </div>
              )}
            </div>
          </Zone>
        </main>

        <footer className="border-t border-white/5 px-8 py-4 flex items-center justify-between text-sm text-slate-300">
          <div>Today's Check-ins: <span className="font-semibold text-white"><AnimatedCount value={checkins} /></span></div>
          <div>Current Service: <span className="text-white">Sunday</span></div>
          <div className="text-slate-400">Face 0 · Print 0 · QR 0 · Manual 0</div>
        </footer>
      </div>
    </div>
  );
}
