import type { RegistrationData } from "@/types";

export type FormAction =
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "UPDATE_PERSONAL"; patch: Partial<RegistrationData["personal"]> }
  | { type: "UPDATE_CONTACT"; patch: Partial<RegistrationData["contact"]> }
  | { type: "UPDATE_FAMILY"; patch: Partial<RegistrationData["family"]> }
  | { type: "UPDATE_CHURCH"; patch: Partial<RegistrationData["churchLife"]> }
  | { type: "UPDATE_SPIRITUAL"; patch: Partial<RegistrationData["spiritual"]> }
  | { type: "UPDATE_CONSENT"; patch: Partial<RegistrationData["consent"]> }
  | { type: "SET_ERRORS"; errors: Record<string, string> }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_SUBMITTED"; id: string };

export interface FormState {
  currentStep: number;
  data: RegistrationData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submissionId: string | null;
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_STEP": return { ...state, currentStep: action.step, errors: {} };
    case "NEXT": return { ...state, currentStep: Math.min(6, state.currentStep + 1), errors: {} };
    case "BACK": return { ...state, currentStep: Math.max(1, state.currentStep - 1), errors: {} };
    case "UPDATE_PERSONAL": return { ...state, data: { ...state.data, personal: { ...state.data.personal, ...action.patch } } };
    case "UPDATE_CONTACT": return { ...state, data: { ...state.data, contact: { ...state.data.contact, ...action.patch } } };
    case "UPDATE_FAMILY": return { ...state, data: { ...state.data, family: { ...state.data.family, ...action.patch } } };
    case "UPDATE_CHURCH": return { ...state, data: { ...state.data, churchLife: { ...state.data.churchLife, ...action.patch } } };
    case "UPDATE_SPIRITUAL": return { ...state, data: { ...state.data, spiritual: { ...state.data.spiritual, ...action.patch } } };
    case "UPDATE_CONSENT": return { ...state, data: { ...state.data, consent: { ...state.data.consent, ...action.patch } } };
    case "SET_ERRORS": return { ...state, errors: action.errors };
    case "SET_SUBMITTING": return { ...state, isSubmitting: action.value };
    case "SET_SUBMITTED": return { ...state, isSubmitted: true, submissionId: action.id, isSubmitting: false };
  }
}
