const KEY = "chivra_onboarding_v1";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(KEY) === "done";
}

export function completeOnboarding() {
  localStorage.setItem(KEY, "done");
}

export function resetOnboarding() {
  localStorage.removeItem(KEY);
}
