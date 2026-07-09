import { createFileRoute } from "@tanstack/react-router";
import { useReducer } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Church, Send } from "lucide-react";
import { Button } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";
import { supabase } from "@/integrations/supabase/client";
import { initialRegistrationData, completenessScore } from "@/lib/registration";
import { isValidNigerianPhone } from "@/lib/nigeria";
import { formReducer, type FormState } from "@/features/register/reducer";
import { StepIndicator } from "@/features/register/StepIndicator";
import { Step1Personal } from "@/features/register/Step1Personal";
import { Step2Contact } from "@/features/register/Step2Contact";
import { Step3Family } from "@/features/register/Step3Family";
import { Step4Church } from "@/features/register/Step4Church";
import { Step5Spiritual } from "@/features/register/Step5Spiritual";
import { Step6Review } from "@/features/register/Step6Review";
import { SuccessScreen } from "@/features/register/SuccessScreen";

export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
});

const initialState: FormState = {
  currentStep: 1,
  data: initialRegistrationData(),
  errors: {},
  isSubmitting: false,
  isSubmitted: false,
  submissionId: null,
};

function validateStep(step: number, data: FormState["data"]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!data.personal.firstName || data.personal.firstName.trim().length < 2) errors.firstName = "First name is required (min 2 chars)";
    if (!data.personal.lastName || data.personal.lastName.trim().length < 2) errors.lastName = "Last name is required (min 2 chars)";
    if (!data.personal.dob) errors.dob = "Date of birth is required";
    else {
      const d = new Date(data.personal.dob);
      const now = new Date();
      if (d >= now) errors.dob = "Must be a past date";
      const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (years > 120) errors.dob = "Invalid date of birth";
    }
    if (!data.personal.gender) errors.gender = "Gender is required";
  }
  if (step === 2) {
    if (!data.contact.phonePrimary) errors.phonePrimary = "Primary phone is required";
    else if (!isValidNigerianPhone(data.contact.phonePrimary)) errors.phonePrimary = "Invalid Nigerian phone format";
    if (data.contact.phoneSecondary && !isValidNigerianPhone(data.contact.phoneSecondary)) errors.phoneSecondary = "Invalid phone format";
    if (!data.contact.state) errors.state = "State is required";
    if (data.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email)) errors.email = "Invalid email";
  }
  if (step === 3) {
    if (!data.family.maritalStatus) errors.maritalStatus = "Marital status is required";
    if (data.family.maritalStatus === "married" && !data.family.spouseName) errors.spouseName = "Spouse name required";
    data.family.children.forEach((c, i) => { if (!c.name) errors[`child_${i}`] = "Name required"; });
  }
  return errors;
}

function RegisterPage() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { showToast } = useToastContext();

  const handleNext = () => {
    const errors = validateStep(state.currentStep, state.data);
    if (Object.keys(errors).length) {
      dispatch({ type: "SET_ERRORS", errors });
      showToast("Please fix the errors before continuing", "error");
      return;
    }
    dispatch({ type: "NEXT" });
  };

  const handleSubmit = async () => {
    if (!state.data.consent.infoAccurate || !state.data.consent.churchUse) {
      showToast("Please accept the required consents", "error");
      return;
    }
    dispatch({ type: "SET_SUBMITTING", value: true });
    try {
      const { photoFile: _pf, photoPreview: _pp, ...personal } = state.data.personal;
      void _pf; void _pp;
      const { data, error } = await supabase.from("member_registrations").insert({
        personal,
        contact: state.data.contact,
        family: state.data.family,
        church_life: state.data.churchLife,
        spiritual: state.data.spiritual,
        consent: state.data.consent,
        cell_group_id: state.data.churchLife.cellGroupId,
        status: "pending",
        completeness_score: completenessScore(state.data),
      }).select("id").single();
      if (error) throw error;
      dispatch({ type: "SET_SUBMITTED", id: (data as { id: string }).id });
      showToast("Registration submitted!", "success");
    } catch (err) {
      dispatch({ type: "SET_SUBMITTING", value: false });
      showToast(err instanceof Error ? err.message : "Submission failed", "error");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden py-8 px-4" style={{ backgroundColor: "#080c16" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-violet-600 opacity-15 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-blue-600 opacity-15 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center">
            <Church className="text-white" size={28} />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
          {state.isSubmitted ? (
            <SuccessScreen phone={state.data.contact.phonePrimary} />
          ) : (
            <>
              <StepIndicator currentStep={state.currentStep} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={state.currentStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  {state.currentStep === 1 && (
                    <Step1Personal data={state.data.personal} errors={state.errors}
                      onChange={(patch) => dispatch({ type: "UPDATE_PERSONAL", patch })} />
                  )}
                  {state.currentStep === 2 && (
                    <Step2Contact data={state.data.contact} errors={state.errors}
                      onChange={(patch) => dispatch({ type: "UPDATE_CONTACT", patch })} />
                  )}
                  {state.currentStep === 3 && (
                    <Step3Family data={state.data.family} errors={state.errors}
                      onChange={(patch) => dispatch({ type: "UPDATE_FAMILY", patch })} />
                  )}
                  {state.currentStep === 4 && (
                    <Step4Church data={state.data.churchLife} errors={state.errors}
                      onChange={(patch) => dispatch({ type: "UPDATE_CHURCH", patch })} />
                  )}
                  {state.currentStep === 5 && (
                    <Step5Spiritual data={state.data.spiritual}
                      onChange={(patch) => dispatch({ type: "UPDATE_SPIRITUAL", patch })} />
                  )}
                  {state.currentStep === 6 && (
                    <Step6Review data={state.data} onEdit={(s) => dispatch({ type: "SET_STEP", step: s })}
                      onConsentChange={(patch) => dispatch({ type: "UPDATE_CONSENT", patch })} />
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => dispatch({ type: "BACK" })} disabled={state.currentStep === 1}>
                  <ArrowLeft size={16} /> Back
                </Button>
                {state.currentStep < 6 ? (
                  <Button onClick={handleNext}>
                    Next <ArrowRight size={16} />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    loading={state.isSubmitting}
                    disabled={!state.data.consent.infoAccurate || !state.data.consent.churchUse}
                  >
                    <Send size={16} /> Submit registration
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
