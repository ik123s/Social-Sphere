import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Version Registry ──────────────────────────────────────────────────────────
// To release a new update, add an entry to VERSION_HISTORY and bump CURRENT.
// update_type rules:
//   patch  → 1-2 small fixes / text changes
//   minor  → 3-4 moderate changes or small feature additions
//   major  → 5+ changes, structural redesign, or breaking new features
// force_update: major versions always force; patch/minor allow deferral.
// delay_limit_days: how many days before "Later" expires (major = 0 = instant force).

export interface VersionEntry {
  version: string;           // semver label  e.g. "2.0.0"
  version_code: number;      // monotonically increasing integer
  update_type: "patch" | "minor" | "major";
  released_at: string;       // ISO date string
  force_update: boolean;     // blocks app until installed
  delay_limit_days: number;  // 0 = force immediately
  update_description: string;
  changes: string[];
}

const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.0.0",
    version_code: 1,
    update_type: "major",
    released_at: "2026-04-01T00:00:00Z",
    force_update: false,
    delay_limit_days: 0,
    update_description: "Initial release",
    changes: [
      "WhatsApp-style AI chat interface",
      "AI contacts with personality and memory",
      "Real-time streaming responses",
      "Status feed with story viewer",
      "Contact relationship progression system",
    ],
  },
  {
    version: "1.1.0",
    version_code: 2,
    update_type: "minor",
    released_at: "2026-05-01T00:00:00Z",
    force_update: false,
    delay_limit_days: 5,
    update_description: "Media & onboarding update",
    changes: [
      "Voice notes with waveform playback",
      "Image and screenshot sharing in chats",
      "5-stage phone verification onboarding",
      "Virtual Chat Number (VCN) discovery",
      "24-hour status expiry (WhatsApp-style)",
    ],
  },
  {
    version: "2.0.0",
    version_code: 3,
    update_type: "major",
    released_at: "2026-05-07T00:00:00Z",
    force_update: true,
    delay_limit_days: 0,
    update_description: "Platform 2.0 — versioned update system",
    changes: [
      "Intelligent versioned update system with auto-classification",
      "Multi-stage install experience: Download → Installing → Complete",
      "Force-update enforcement for major releases",
      "Server-side version registry with full update history",
      "Simulated app restart with session reset on version change",
      "Update severity auto-detection (patch / minor / major)",
      "Persistent update dismissal with grace period tracking",
    ],
  },
  {
    version: "2.0.1",
    version_code: 4,
    update_type: "patch",
    released_at: "2026-05-07T12:00:00Z",
    force_update: false,
    delay_limit_days: 3,
    update_description: "Stability & polish patch",
    changes: [
      "Smoother update screen transition animations",
      "Fixed OTP code display alignment on small screens",
    ],
  },
];

// The version currently deployed on the server (latest in history)
const LATEST = VERSION_HISTORY[VERSION_HISTORY.length - 1]!;

// Minimum supported version_code — clients below this are force-blocked
const MINIMUM_SUPPORTED_VERSION_CODE = 1;

// GET /api/version
router.get("/version", (_req, res): void => {
  res.json({
    latest_version: LATEST.version,
    latest_version_code: LATEST.version_code,
    update_type: LATEST.update_type,
    force_update: LATEST.force_update,
    delay_limit_days: LATEST.delay_limit_days,
    update_description: LATEST.update_description,
    changes: LATEST.changes,
    released_at: LATEST.released_at,
    minimum_supported_version_code: MINIMUM_SUPPORTED_VERSION_CODE,
  });
});

// GET /api/version/history — full changelog
router.get("/version/history", (_req, res): void => {
  res.json([...VERSION_HISTORY].reverse());
});

export default router;
