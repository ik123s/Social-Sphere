// ── Client version ────────────────────────────────────────────────────────────
// This must match the highest version_code the user has been shipped as a
// built client. Applied version (from localStorage) takes over after an
// in-session update so the screen never re-triggers for the same release.
const CLIENT_VERSION = "3.0.0";
const CLIENT_VERSION_CODE = 5;

// ── Storage keys ─────────────────────────────────────────────────────────────
const DISMISSED_KEY = "chivra_update_dismissed_v"; // + version string suffix
const APPLIED_KEY   = "chivra_applied_version_code";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VersionResponse {
  latest_version: string;
  latest_version_code: number;
  update_type: "patch" | "minor" | "major";
  force_update: boolean;
  delay_limit_days: number;
  update_description: string;
  changes: string[];
  released_at: string;
  minimum_supported_version_code: number;
}

export interface UpdateState {
  available: boolean;
  forced: boolean;
  info: VersionResponse;
}

// ── API ───────────────────────────────────────────────────────────────────────
export async function fetchVersionInfo(): Promise<VersionResponse | null> {
  try {
    const res = await fetch("/api/version");
    if (!res.ok) return null;
    return await res.json() as VersionResponse;
  } catch {
    return null;
  }
}

export function getClientVersion() {
  return { version: CLIENT_VERSION, version_code: CLIENT_VERSION_CODE };
}

// ── Applied version tracking ──────────────────────────────────────────────────
// After the user completes an update, we store the applied version_code in
// localStorage so resolveUpdateState treats them as already up to date —
// even though the JS bundle version_code hasn't changed.
export function getAppliedVersionCode(): number {
  const raw = localStorage.getItem(APPLIED_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

export function markVersionApplied(version_code: number) {
  localStorage.setItem(APPLIED_KEY, String(version_code));
}

// ── Dismissal logic ───────────────────────────────────────────────────────────
function dismissedKey(version: string) {
  return DISMISSED_KEY + version;
}

export function dismissUpdate(version: string) {
  localStorage.setItem(dismissedKey(version), String(Date.now()));
}

export function getDaysSinceDismissed(version: string): number | null {
  const raw = localStorage.getItem(dismissedKey(version));
  if (!raw) return null;
  const ts = parseInt(raw, 10);
  if (isNaN(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

export function clearDismissed(version: string) {
  localStorage.removeItem(dismissedKey(version));
}

// ── Decision logic ────────────────────────────────────────────────────────────
export function resolveUpdateState(info: VersionResponse): UpdateState | null {
  const client = getClientVersion();
  // The effective version is the highest of the compiled bundle OR what the
  // user has already applied in this browser via an in-session update.
  const effectiveCode = Math.max(client.version_code, getAppliedVersionCode());

  // Already on latest (or applied it this session) — no update needed
  if (info.latest_version_code <= effectiveCode) return null;

  // Below minimum supported — force block regardless of type
  if (effectiveCode < info.minimum_supported_version_code) {
    return { available: true, forced: true, info };
  }

  // Major version OR server explicitly flags force_update → always force
  if (info.update_type === "major" || info.force_update) {
    return { available: true, forced: true, info };
  }

  // Grace period expired → escalate to forced
  const days = getDaysSinceDismissed(info.latest_version);
  if (days !== null && days >= info.delay_limit_days) {
    return { available: true, forced: true, info };
  }

  // Within active grace period — skip silently
  if (days !== null && days < info.delay_limit_days) return null;

  // First time seeing this update — prompt (deferrable)
  return { available: true, forced: false, info };
}
