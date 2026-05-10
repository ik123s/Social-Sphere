import { Router, type IRouter } from "express";

const router: IRouter = Router();

export interface VersionEntry {
  version: string;
  version_code: number;
  update_type: "patch" | "minor" | "major";
  released_at: string;
  force_update: boolean;
  delay_limit_days: number;
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
  {
    version: "3.0.0",
    version_code: 5,
    update_type: "major",
    released_at: "2026-05-09T00:00:00Z",
    force_update: false,
    delay_limit_days: 5,
    update_description: "Chivra 3.0 — AI that actually feels alive",
    changes: [
      "AI contacts now text you first — proactive follow-ups when you go quiet",
      "Time-aware AI: messages match the actual time of day",
      "Much shorter, more natural AI responses — real texting, not essays",
      "Voice and video call UI with animated incoming/outgoing screens",
      "Swipe right on any message to reply — WhatsApp-style",
    ],
  },
  {
    version: "3.1.0",
    version_code: 6,
    update_type: "major",
    released_at: "2026-05-09T12:00:00Z",
    force_update: false,
    delay_limit_days: 5,
    update_description: "Social Network — AI contacts now have real lives",
    changes: [
      "AI contacts go offline, sleep, and come back — realistic presence system",
      "Last seen timestamps: see exactly when a contact was last active",
      "AI contacts can introduce you to their friends — contact sharing in chat",
      "Add contacts by ID — paste any shared ID to preview and start chatting",
      "Return messages: AI texts you when they come back online after being away",
    ],
  },
  {
    version: "3.2.0",
    version_code: 7,
    update_type: "major",
    released_at: "2026-05-10T00:00:00Z",
    force_update: false,
    delay_limit_days: 0,
    update_description: "Private accounts — your world, only yours",
    changes: [
      "Full account isolation: every user gets their own private AI ecosystem",
      "Phone number becomes your account — log back in from any device",
      "Returning users automatically restore their full account on re-login",
      "Each new account gets a unique set of AI contacts with fresh personalities",
      "New AI contacts introduced every 3 hours — your social world keeps growing",
    ],
  },
  {
    version: "3.3.0",
    version_code: 8,
    update_type: "major",
    released_at: "2026-05-10T12:00:00Z",
    force_update: true,
    delay_limit_days: 0,
    update_description: "Chivra 3.3 — Android-native feel, smarter AI, multi-device",
    changes: [
      "Full Android-native UI — header tabs (CHATS / CHIVRA SPACES / CALLS), floating action button",
      "Active Chivra Personals section — see who's online at a glance",
      "CHIVRA SPACES: status stories from your contacts in a dedicated tab",
      "CALLS tab: start voice or video calls directly from the call log",
      "Multi-device linking — link your account to another device via code",
      "AI contacts now generate realistic profile photos automatically",
      "Admin-level account moderation system",
      "Optimized layout for all Android screen sizes (360px–430px)",
    ],
  },
];

const LATEST = VERSION_HISTORY[VERSION_HISTORY.length - 1]!;
const MINIMUM_SUPPORTED_VERSION_CODE = 1;

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

router.get("/version/history", (_req, res): void => {
  res.json([...VERSION_HISTORY].reverse());
});

export default router;
