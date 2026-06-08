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
    version: "1.0.0", version_code: 1, update_type: "major", released_at: "2026-04-01T00:00:00Z",
    force_update: false, delay_limit_days: 0, update_description: "Initial release",
    changes: ["WhatsApp-style AI chat interface","AI contacts with personality and memory","Real-time streaming responses","Status feed with story viewer","Contact relationship progression system"],
  },
  {
    version: "1.1.0", version_code: 2, update_type: "minor", released_at: "2026-05-01T00:00:00Z",
    force_update: false, delay_limit_days: 5, update_description: "Media & onboarding update",
    changes: ["Voice notes with waveform playback","Image and screenshot sharing in chats","5-stage phone verification onboarding","Virtual Chat Number (VCN) discovery","24-hour status expiry (WhatsApp-style)"],
  },
  {
    version: "2.0.0", version_code: 3, update_type: "major", released_at: "2026-05-07T00:00:00Z",
    force_update: true, delay_limit_days: 0, update_description: "Platform 2.0 — versioned update system",
    changes: ["Intelligent versioned update system","Multi-stage install experience","Force-update enforcement for major releases","Server-side version registry","Simulated app restart on version change"],
  },
  {
    version: "2.0.1", version_code: 4, update_type: "patch", released_at: "2026-05-07T12:00:00Z",
    force_update: false, delay_limit_days: 3, update_description: "Stability & polish patch",
    changes: ["Smoother update screen animations","Fixed OTP code display alignment"],
  },
  {
    version: "3.0.0", version_code: 5, update_type: "major", released_at: "2026-05-09T00:00:00Z",
    force_update: false, delay_limit_days: 5, update_description: "Chivra 3.0 — AI that actually feels alive",
    changes: ["AI contacts now text you first","Time-aware AI messages","Shorter, more natural AI responses","Voice and video call UI","Swipe right on any message to reply"],
  },
  {
    version: "3.1.0", version_code: 6, update_type: "major", released_at: "2026-05-09T12:00:00Z",
    force_update: false, delay_limit_days: 5, update_description: "Social Network — AI contacts now have real lives",
    changes: ["AI contacts go offline, sleep, and come back","Last seen timestamps","AI contacts can introduce you to their friends","Add contacts by ID","Return messages when contacts come back online"],
  },
  {
    version: "3.2.0", version_code: 7, update_type: "major", released_at: "2026-05-10T00:00:00Z",
    force_update: false, delay_limit_days: 0, update_description: "Private accounts — your world, only yours",
    changes: ["Full account isolation per user","Phone number becomes your account","Returning users auto-restored on re-login","Each account gets unique AI contacts","New AI contacts introduced every 3 hours"],
  },
  {
    version: "3.3.0", version_code: 8, update_type: "major", released_at: "2026-05-10T12:00:00Z",
    force_update: false, delay_limit_days: 0, update_description: "Chivra 3.3 — Android-native feel, smarter AI, multi-device",
    changes: ["Android-native UI — CHATS / CHIVRA SPACES / CALLS tabs","Active Chivra Personals section","CALLS tab with voice and video call log","Multi-device account linking via code","AI contacts auto-generate profile photos on spawn","Admin-level account moderation"],
  },
  {
    version: "3.4.2", version_code: 9, update_type: "major", released_at: "2026-06-08T00:00:00Z",
    force_update: false, delay_limit_days: 0, update_description: "Chivra 3.4 — Connection requests, status reactions, and SEO",
    changes: [
      "Connection request system — send, receive, accept, and decline VCN connections",
      "Pending request inbox with Accept/Decline buttons in the VCN tab",
      "Status reactions — Heart, Fire, Smile, and Wow on any story",
      "Status story view counts — see how popular each post is",
      "Reply to status — tap Reply to jump straight into the contact's chat",
      "Compose status redesign — fixed layout, all controls visible, paste image support",
      "Status images — paste or upload photos directly into your status",
      "SEO improvements — meta description, Open Graph tags, robots.txt",
    ],
  },
  {
    version: "3.4.3", version_code: 10, update_type: "minor", released_at: "2026-06-08T12:00:00Z",
    force_update: true, delay_limit_days: 0, update_description: "Chivra 3.4.3 — Vision, Profile Photos, and Chat Polish",
    changes: [
      "AI can now see and react to photos you send in chat",
      "AI contacts send selfies and photos when you ask — powered by image generation",
      "Upload a profile photo from your camera or gallery",
      "Chat input is now multiline and grows as you type (up to 6 lines)",
      "Paste any image from clipboard directly into the chat composer",
      "3-dot menu in chat with Search, View Contact, and Clear Chat",
      "Search messages within any conversation",
      "Chat scroll and input bar layout improvements",
      "Platform stability improvements (version 2.2.0 features incorporated)",
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
