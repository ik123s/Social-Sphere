import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, userConnectionsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function generateVcn(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let vcn = "";
  for (let i = 0; i < 7; i++) {
    vcn += chars[Math.floor(Math.random() * chars.length)];
  }
  return vcn;
}

async function uniqueVcn(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateVcn();
    const existing = await db.select({ vcn: usersTable.vcn }).from(usersTable).where(eq(usersTable.vcn, candidate));
    if (existing.length === 0) return candidate;
  }
  throw new Error("Could not generate unique VCN");
}

// POST /api/users/register
// Body: { displayName?, avatarUrl?, statusText? }
// Returns existing user if vcn provided in body, else creates new one
router.post("/users/register", async (req, res): Promise<void> => {
  const { vcn: existingVcn, displayName, avatarUrl, statusText } = req.body;

  if (existingVcn) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.vcn, existingVcn));
    if (user) {
      res.json(user);
      return;
    }
  }

  const vcn = await uniqueVcn();
  const [newUser] = await db.insert(usersTable).values({
    vcn,
    displayName: displayName || "User",
    avatarUrl: avatarUrl || null,
    statusText: statusText || "Available",
  }).returning();

  logger.info({ vcn: newUser!.vcn }, "New user registered");
  res.json(newUser);
});

// GET /api/users/vcn/:vcn — find a user by VCN (for search/add flow)
router.get("/users/vcn/:vcn", async (req, res): Promise<void> => {
  const { vcn } = req.params;
  if (!vcn) { res.status(400).json({ error: "VCN required" }); return; }

  const [user] = await db.select({
    vcn: usersTable.vcn,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    statusText: usersTable.statusText,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.vcn, vcn.toUpperCase().trim()));

  if (!user) { res.status(404).json({ error: "No user found with that VCN" }); return; }
  res.json(user);
});

// POST /api/users/connect — connect two users by VCN
// Body: { myVcn, targetVcn }
router.post("/users/connect", async (req, res): Promise<void> => {
  const { myVcn, targetVcn } = req.body;
  if (!myVcn || !targetVcn) { res.status(400).json({ error: "Both VCNs required" }); return; }
  if (myVcn === targetVcn) { res.status(400).json({ error: "Cannot connect to yourself" }); return; }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.vcn, myVcn));
  const [them] = await db.select().from(usersTable).where(eq(usersTable.vcn, targetVcn));

  if (!me) { res.status(404).json({ error: "Your VCN was not found" }); return; }
  if (!them) { res.status(404).json({ error: "Target VCN not found" }); return; }

  const [conn] = await db.insert(userConnectionsTable).values({
    initiatorVcn: myVcn,
    targetVcn,
  }).onConflictDoNothing().returning();

  res.json({ connected: true, user: { vcn: them.vcn, displayName: them.displayName, avatarUrl: them.avatarUrl, statusText: them.statusText } });
});

// GET /api/users/:vcn/connections — list all connections for a user
router.get("/users/:vcn/connections", async (req, res): Promise<void> => {
  const { vcn } = req.params;
  const connections = await db.select().from(userConnectionsTable).where(
    or(
      eq(userConnectionsTable.initiatorVcn, vcn),
      eq(userConnectionsTable.targetVcn, vcn)
    )
  );

  const otherVcns = connections.map(c => c.initiatorVcn === vcn ? c.targetVcn : c.initiatorVcn);
  if (otherVcns.length === 0) { res.json([]); return; }

  const users = await Promise.all(
    otherVcns.map(v => db.select({ vcn: usersTable.vcn, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, statusText: usersTable.statusText }).from(usersTable).where(eq(usersTable.vcn, v)))
  );

  res.json(users.flat());
});

// PATCH /api/users/:vcn — update profile
router.patch("/users/:vcn", async (req, res): Promise<void> => {
  const { vcn } = req.params;
  const { displayName, statusText, avatarUrl } = req.body;

  const updates: Partial<{ displayName: string; statusText: string; avatarUrl: string }> = {};
  if (displayName) updates.displayName = displayName;
  if (statusText !== undefined) updates.statusText = statusText;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.vcn, vcn)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(updated);
});

// In-memory OTP store (phone → { otp, expiresAt })
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/users/request-otp  { phone }
router.post("/users/request-otp", async (req, res): Promise<void> => {
  const { phone } = req.body;
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  logger.info({ phone, otp }, "OTP generated (demo — no real SMS sent)");
  // Return OTP in response for demo purposes (no real SMS service)
  res.json({ success: true, otp });
});

// POST /api/users/verify-otp  { phone, otp }
router.post("/users/verify-otp", async (req, res): Promise<void> => {
  const { phone, otp } = req.body;
  if (!phone || !otp) { res.status(400).json({ error: "phone and otp required" }); return; }
  const stored = otpStore.get(phone);
  if (!stored || Date.now() > stored.expiresAt) {
    res.status(400).json({ error: "OTP expired or not found" }); return;
  }
  if (stored.otp !== String(otp)) {
    res.status(400).json({ error: "Incorrect OTP" }); return;
  }
  otpStore.delete(phone);
  res.json({ success: true });
});

export default router;
