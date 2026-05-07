const APP_VERSION = "1.0.0";
const DISMISSED_KEY = "chivra_update_dismissed_at";
const FORCE_DAYS = 5;

export interface VersionInfo {
  latestVersion: string;
  currentVersion: string;
  forceAfterDays: number;
  updateNotes: string[];
  updateUrl: string;
}

export async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    const res = await fetch("/api/version");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getClientVersion(): string {
  return APP_VERSION;
}

export function isUpdateAvailable(info: VersionInfo): boolean {
  return info.latestVersion !== getClientVersion();
}

/** Returns true when the user already dismissed and the grace window hasn't expired. */
export function isWithinGracePeriod(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < FORCE_DAYS;
}

/** Returns true when dismissed but grace period has now expired (force update). */
export function isForceUpdate(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince >= FORCE_DAYS;
}

export function dismissUpdate() {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

export function clearDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
}
