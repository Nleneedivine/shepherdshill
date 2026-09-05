import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SESSION_KEY = "sh_logo_intro_played";

export function LogoHero() {
  const reduce = useReducedMotion();
  const [skipIntro, setSkipIntro] = useState(true);

  useEffect(() => {
    try {
      const played = sessionStorage.getItem(SESSION_KEY);
      if (!played) {
        setSkipIntro(false);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      setSkipIntro(false);
    }
  }, []);

  // Build keyframes for the intro sequence + infinite float
  const introScale = [0, 1.15, 1, 1, 1.25, 1, 1, 1, 1, 1];
  const introRotate = [0, 0, 0, 360, 360, 360, 360, 360, 360, 360];
  const introY = [0, 0, 0, 0, 0, 0, -20, 0, -12, 0];
  const introTimes = [0, 0.12, 0.18, 0.42, 0.5, 0.58, 0.68, 0.78, 0.86, 1];
  const introOpacity = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  const animate = reduce || skipIntro
    ? { scale: 1, rotate: 0, opacity: 1, y: [0, -10, 0] }
    : {
        scale: introScale,
        rotate: introRotate,
        y: introY,
        opacity: introOpacity,
      };

  const transition: any = reduce
    ? { duration: 0 }
    : skipIntro
      ? { y: { duration: 3, ease: "easeInOut", repeat: Infinity } }
      : {
          duration: 5.2,
          times: introTimes,
          ease: "easeInOut",
        };

  return (
    <div className="relative flex items-center justify-center w-40 h-40 md:w-52 md:h-52 lg:w-56 lg:h-56">
      {/* Animated glow */}
      <div
        aria-hidden="true"
        className="absolute w-[200%] h-[200%] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(45,27,142,0.5) 0%, transparent 70%)",
          opacity: 0.35,
          animation: "logoGlow 9s ease-in-out infinite",
        }}
      />

      {/* Pulse rings */}
      {!reduce &&
        [
          { color: "rgba(45,27,142,0.5)", delay: 0 },
          { color: "rgba(204,0,0,0.4)", delay: 1 },
          { color: "rgba(26,122,42,0.4)", delay: 0.5 },
        ].map((r, i) => (
          <motion.div
            key={i}
            aria-hidden="true"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `2px solid ${r.color}` }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{
              duration: 2,
              delay: r.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}

      <motion.img
        src="/logo.png"
        alt="Shepherd's Hill RCCG Logo"
        className="relative z-10 w-full h-full object-contain dark:mix-blend-screen"
        style={{
          filter:
            "drop-shadow(0 0 20px rgba(45,27,142,0.8)) drop-shadow(0 0 40px rgba(204,0,0,0.4))",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={animate}
        transition={transition}
        onAnimationComplete={() => {
          // After intro, kick off the gentle float loop.
          if (!skipIntro) setSkipIntro(true);
        }}
      />
    </div>
  );
}
