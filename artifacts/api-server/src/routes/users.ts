import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, userConnectionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { spawnContactForUser } from "../lib/autoSpawn";

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
router.post("/users/register", async (req, res): Promise<void> => {
  const { vcn: existingVcn, displayName, avatarUrl, statusText, phone } = req.body;

  if (existingVcn) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.vcn, existingVcn));
    if (user) {
      if (phone && !user.phone) {
        await db.update(usersTable).set({ phone }).where(eq(usersTable.vcn, existingVcn));
      }
      res.json({ ...user, phone: user.phone ?? phone ?? null });
      return;
    }
  }

  if (phone) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
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
    phone: phone || null,
  }).returning();

  logger.info({ vcn: newUser!.vcn }, "New user registered");
  res.json(newUser);
});

// GET /api/users/vcn/:vcn
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

// POST /api/users/connect
router.post("/users/connect", async (req, res): Promise<void> => {
  const { myVcn, targetVcn } = req.body;
  if (!myVcn || !targetVcn) { res.status(400).json({ error: "Both VCNs required" }); return; }
  if (myVcn === targetVcn) { res.status(400).json({ error: "Cannot connect to yourself" }); return; }

  const [me]   = await db.select().from(usersTable).where(eq(usersTable.vcn, myVcn));
  const [them] = await db.select().from(usersTable).where(eq(usersTable.vcn, targetVcn));

  if (!me)   { res.status(404).json({ error: "Your VCN was not found" }); return; }
  if (!them) { res.status(404).json({ error: "Target VCN not found" }); return; }

  await db.insert(userConnectionsTable).values({ initiatorVcn: myVcn, targetVcn }).onConflictDoNothing();

  res.json({ connected: true, user: { vcn: them.vcn, displayName: them.displayName, avatarUrl: them.avatarUrl, statusText: them.statusText } });
});

// GET /api/users/:vcn/connections
router.get("/users/:vcn/connections", async (req, res): Promise<void> => {
  const { vcn } = req.params;
  const connections = await db.select().from(userConnectionsTable).where(
    or(eq(userConnectionsTable.initiatorVcn, vcn), eq(userConnectionsTable.targetVcn, vcn))
  );

  const otherVcns = connections.map(c => c.initiatorVcn === vcn ? c.targetVcn : c.initiatorVcn);
  if (otherVcns.length === 0) { res.json([]); return; }

  const users = await Promise.all(
    otherVcns.map(v => db.select({ vcn: usersTable.vcn, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, statusText: usersTable.statusText }).from(usersTable).where(eq(usersTable.vcn, v)))
  );
  res.json(users.flat());
});

// PATCH /api/users/:vcn
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

// ── OTP store ─────────────────────────────────────────────────────────────────
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/users/request-otp
router.post("/users/request-otp", async (req, res): Promise<void> => {
  const { phone } = req.body;
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  logger.info({ phone, otp }, "OTP generated (demo — no real SMS sent)");
  res.json({ success: true, otp });
});

// POST /api/users/verify-otp
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

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existingUser) {
    if (existingUser.banned) {
      logger.warn({ vcn: existingUser.vcn, phone }, "Banned user attempted login");
      res.status(403).json({ error: "This account has been suspended. Contact support." }); return;
    }
    logger.info({ vcn: existingUser.vcn, phone }, "Returning user verified via OTP");
    res.json({ success: true, isReturningUser: true, user: existingUser });
    return;
  }

  res.json({ success: true, isReturningUser: false });
});

// POST /api/users/initialize-contacts
router.post("/users/initialize-contacts", async (req, res): Promise<void> => {
  const userId = (req.headers["x-user-id"] as string) || req.body?.userId;
  if (!userId) { res.status(400).json({ error: "User ID required" }); return; }

  res.json({ success: true, queued: 3 });

  (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const contact = await spawnContactForUser(userId);
        if (contact) {
          logger.info({ contactId: contact.id, name: contact.name, userId }, "Starter contact created");
        }
      } catch (err) {
        logger.error({ err, userId }, "Failed to create starter contact");
      }
    }
    logger.info({ userId }, "Starter contacts initialization complete");
  })();
});

// ── Multi-device link codes ───────────────────────────────────────────────────
// In-memory store: code → { vcn, expiresAt }
const linkCodeStore = new Map<string, { vcn: string; expiresAt: number }>();

function generateLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/users/generate-link-code  { vcn }
router.post("/users/generate-link-code", async (req, res): Promise<void> => {
  const vcn = (req.headers["x-user-id"] as string) || req.body?.vcn;
  if (!vcn) { res.status(400).json({ error: "VCN required" }); return; }

  const [user] = await db.select({ vcn: usersTable.vcn }).from(usersTable).where(eq(usersTable.vcn, vcn));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const code = generateLinkCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  linkCodeStore.set(code, { vcn: user.vcn, expiresAt });

  logger.info({ vcn, code }, "Link code generated");
  res.json({ code, expiresInMin: 10 });
});

// POST /api/users/verify-link-code  { code }
router.post("/users/verify-link-code", async (req, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  const stored = linkCodeStore.get(code.toUpperCase().replace(/\s/g, ""));
  if (!stored || Date.now() > stored.expiresAt) {
    res.status(400).json({ error: "Invalid or expired link code" }); return;
  }
  linkCodeStore.delete(code);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.vcn, stored.vcn));
  if (!user) { res.status(404).json({ error: "Account not found" }); return; }
  if (user.banned) { res.status(403).json({ error: "This account has been suspended" }); return; }

  logger.info({ vcn: user.vcn }, "Device linked via link code");
  res.json({ success: true, user });
});

// ── Admin endpoints ───────────────────────────────────────────────────────────
// POST /api/admin/ban  { vcn, secret }
router.post("/admin/ban", async (req, res): Promise<void> => {
  const { vcn, secret, unban } = req.body;
  const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "chivra-admin-2026";
  if (secret !== ADMIN_SECRET) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!vcn) { res.status(400).json({ error: "vcn required" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ banned: !unban })
    .where(eq(usersTable.vcn, vcn.toUpperCase()))
    .returning({ vcn: usersTable.vcn, banned: usersTable.banned });

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  logger.info({ vcn: updated.vcn, banned: updated.banned }, "Admin ban action");
  res.json({ success: true, vcn: updated.vcn, banned: updated.banned });
});

export default router;
