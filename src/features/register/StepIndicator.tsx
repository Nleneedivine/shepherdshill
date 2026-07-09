import { motion } from "framer-motion";
import { Check } from "lucide-react";

const STEPS = ["Personal", "Contact", "Family", "Church Life", "Spiritual", "Review"];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const isComplete = step < currentStep;
          const isActive = step === currentStep;
          return (
            <div key={label} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isComplete
                      ? "bg-gradient-to-br from-violet-600 to-blue-500 text-white"
                      : isActive
                      ? "border-2 border-transparent bg-clip-padding text-white bg-white/5"
                      : "bg-white/10 text-slate-400"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundImage:
                            "linear-gradient(#0d1117,#0d1117),linear-gradient(135deg,#7c3aed,#3b82f6)",
                          backgroundOrigin: "border-box",
                          backgroundClip: "padding-box,border-box",
                        }
                      : undefined
                  }
                >
                  {isComplete ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check size={16} />
                    </motion.span>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`mt-2 text-xs whitespace-nowrap ${
                    isActive ? "text-white font-medium" : "text-slate-500"
                  } ${isActive ? "" : "hidden sm:block"}`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 -mt-6 ${
                    step < currentStep
                      ? "bg-gradient-to-r from-violet-600 to-blue-500"
                      : "bg-white/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
