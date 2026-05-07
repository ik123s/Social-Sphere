import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Bump LATEST_VERSION here to trigger the update screen for all clients.
// FORCE_AFTER_DAYS controls how many days until the update becomes mandatory.
const LATEST_VERSION = "1.1.0";
const CURRENT_CLIENT_VERSION = "1.0.0";
const FORCE_AFTER_DAYS = 5;

const UPDATE_NOTES = [
  "Voice notes and image sharing in chats",
  "Full onboarding flow with phone verification",
  "24-hour status expiry (WhatsApp-style)",
  "Virtual Chat Number (VCN) discovery system",
  "Improved AI contact memory and personality",
];

router.get("/version", (_req, res): void => {
  res.json({
    latestVersion: LATEST_VERSION,
    currentVersion: CURRENT_CLIENT_VERSION,
    forceAfterDays: FORCE_AFTER_DAYS,
    updateNotes: UPDATE_NOTES,
    updateUrl: "https://chivra.app/update",
  });
});

export default router;
