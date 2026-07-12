import { createFileRoute } from "@tanstack/react-router";
import { useReducer, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Church, Send } from "lucide-react";
import { Button } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";
import { submitRegistration } from "@/lib/submitRegistration";
import { initialRegistrationData } from "@/lib/registration";
import { isValidNigerianPhone } from "@/lib/nigeria";
import { formReducer, type FormState } from "@/features/register/reducer";
import { useFormDraft } from "@/hooks/useFormDraft";
// ...other imports unchanged

const initialState: FormState = {
  currentStep: 1,
  data: initialRegistrationData(),
  errors: {},
  isSubmitting: false,
  isSubmitted: false,
  submissionId: null,
};

function RegisterPage() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { showToast } = useToastContext();
  const { draft, saveDraft, clearDraft, isDraftLoading } = useFormDraft("registration");
  const hasLoadedDraft = useRef(false);

  // Load saved draft once, when it arrives
  useEffect(() => {
    if (!isDraftLoading && draft && !hasLoadedDraft.current) {
      hasLoadedDraft.current = true;
      dispatch({ type: "LOAD_DRAFT", data: draft.formData, step: draft.currentStep });
      // ^ you'll need a LOAD_DRAFT action in formReducer that sets state.data and state.currentStep
    }
  }, [isDraftLoading, draft]);

  // Save draft whenever data or step changes (debounced inside the hook already)
  useEffect(() => {
    if (hasLoadedDraft.current || !draft) {
      saveDraft(state.data as unknown as Record<string, unknown>, state.currentStep);
    }
  }, [state.data, state.currentStep]);

  // ...rest of component unchanged, except:

  const handleSubmit = async () => {
    if (!state.data.consent.infoAccurate || !state.data.consent.churchUse) {
      showToast("Please accept the required consents", "error");
      return;
    }
    dispatch({ type: "SET_SUBMITTING", value: true });
    const result = await submitRegistration(state.data);
    if (result.success && result.submissionId) {
      dispatch({ type: "SET_SUBMITTED", id: result.submissionId });
      await clearDraft(); // clear the draft once successfully submitted
      showToast("Registration submitted!", "success");
    } else {
      dispatch({ type: "SET_SUBMITTING", value: false });
      showToast(result.error ?? "Submission failed", "error");
    }
  };

  // ...rest unchanged
}
