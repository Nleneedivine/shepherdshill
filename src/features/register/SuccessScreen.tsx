import { motion } from "framer-motion";
import { Check } from "lucide-react";

export function SuccessScreen({ phone }: { phone: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6"
      >
        <motion.svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M5 12l5 5L20 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
        </motion.svg>
      </motion.div>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
        Registration Submitted!
      </h2>
      <p className="mt-3 text-slate-300">
        We'll review your information and send a confirmation to <span className="text-white font-medium">{phone || "your phone"}</span>.
      </p>
      <p className="mt-1 text-sm text-slate-500">Expected response within 24 hours.</p>
    </motion.div>
  );
}
