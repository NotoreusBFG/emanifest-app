import type { OnboardingProgress } from "@/services/onboardingRepository";

export type StepStatus = "todo" | "done" | "failed";

export interface OnboardingStepStatuses {
  cdxAccount: StepStatus;
  epaId: StepStatus;
  esa: StepStatus;
  apiKeyGenerated: StepStatus;
  apiCredentials: StepStatus;
}

/** Single source of truth for interpreting `OnboardingProgress` into
 * per-step statuses -- shared by the onboarding wizard and the dashboard's
 * account-status card so the two never drift on what counts as "done". */
export function deriveOnboardingStepStatuses(progress: OnboardingProgress): OnboardingStepStatuses {
  return {
    cdxAccount: progress.cdxAccountDoneAt ? "done" : "todo",
    epaId: progress.epaIdRequestedAt ? "done" : "todo",
    esa: progress.esaCompletedAt ? "done" : "todo",
    apiKeyGenerated: progress.apiKeyGeneratedAt ? "done" : "todo",
    apiCredentials: progress.apiCredentialsValidatedAt
      ? "done"
      : progress.apiCredentialsEnteredAt
      ? "failed"
      : "todo",
  };
}

export type OverallOnboardingStatus = "red" | "yellow" | "green";

/** Red = nothing started, yellow = partially set up (or credentials saved
 * but not yet verified), green = every step done. */
export function deriveOverallOnboardingStatus(statuses: OnboardingStepStatuses): OverallOnboardingStatus {
  const values = Object.values(statuses);
  if (values.every((s) => s === "done")) return "green";
  if (values.every((s) => s === "todo")) return "red";
  return "yellow";
}
