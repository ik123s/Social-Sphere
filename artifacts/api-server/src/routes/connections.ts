import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { connectionRequestsTable, usersTable, userConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /api/connections/request
router.post("/connections/request", async (req, res): Promise<void> => {
  const fromVcn = (req.headers["x-user-id"] as string) || req.body?.fromVcn;
  const { toVcn, message } = req.body;
  if (!fromVcn || !toVcn) { res.status(400).json({ error: "fromVcn and toVcn required" }); return; }
  if (fromVcn === toVcn) { res.status(400).json({ error: "Cannot send a request to yourself" }); return; }

  const [from] = await db.select({ vcn: usersTable.vcn }).from(usersTable).where(eq(usersTable.vcn, fromVcn));
  const [to]   = await db.select({ vcn: usersTable.vcn }).from(usersTable).where(eq(usersTable.vcn, toVcn));
  if (!from) { res.status(404).json({ error: "Your account not found" }); return; }
  if (!to)   { res.status(404).json({ error: "Target user not found" }); return; }

  const [existing] = await db.select().from(connectionRequestsTable)
    .where(and(eq(connectionRequestsTable.fromVcn, fromVcn), eq(connectionRequestsTable.toVcn, toVcn)));
  if (existing) {
    res.json({ success: true, request: existing, alreadyExists: true });
    return;
  }

  const [inserted] = await db.insert(connectionRequestsTable)
    .values({ fromVcn, toVcn, status: "pending", message: message ?? null })
    .returning();
  logger.info({ fromVcn, toVcn }, "Connection request sent");
  res.json({ success: true, request: inserted });
});

// POST /api/connections/respond  { requestId, action: "accept"|"decline" }
router.post("/connections/respond", async (req, res): Promise<void> => {
  const myVcn = (req.headers["x-user-id"] as string) || req.body?.myVcn;
  const { requestId, action } = req.body;
  if (!myVcn || !requestId || !action) { res.status(400).json({ error: "myVcn, requestId, action required" }); return; }

  const [request] = await db.select().from(connectionRequestsTable)
    .where(and(eq(connectionRequestsTable.id, Number(requestId)), eq(connectionRequestsTable.toVcn, myVcn)));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }

  const newStatus = action === "accept" ? "accepted" : "declined";
  const [updated] = await db.update(connectionRequestsTable)
    .set({ status: newStatus, respondedAt: new Date() })
    .where(eq(connectionRequestsTable.id, Number(requestId)))
    .returning();

  if (action === "accept") {
    await db.insert(userConnectionsTable)
      .values({ initiatorVcn: request.fromVcn, targetVcn: myVcn })
      .onConflictDoNothing();
    logger.info({ fromVcn: request.fromVcn, toVcn: myVcn }, "Connection accepted, userConnection created");
  }

  res.json({ success: true, request: updated });
});

// GET /api/connections/pending  — requests I received and haven't acted on
router.get("/connections/pending", async (req, res): Promise<void> => {
  const myVcn = (req.headers["x-user-id"] as string) || (req.query["vcn"] as string);
  if (!myVcn) { res.status(400).json({ error: "VCN required" }); return; }

  const requests = await db.select().from(connectionRequestsTable)
    .where(and(eq(connectionRequestsTable.toVcn, myVcn), eq(connectionRequestsTable.status, "pending")));

  const enriched = await Promise.all(requests.map(async r => {
    const [sender] = await db.select({
      vcn: usersTable.vcn,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      statusText: usersTable.statusText,
    }).from(usersTable).where(eq(usersTable.vcn, r.fromVcn));
    return { ...r, senderInfo: sender ?? null };
  }));

  res.json(enriched);
});

// GET /api/connections/sent  — requests I sent
router.get("/connections/sent", async (req, res): Promise<void> => {
  const myVcn = (req.headers["x-user-id"] as string) || (req.query["vcn"] as string);
  if (!myVcn) { res.status(400).json({ error: "VCN required" }); return; }

  const requests = await db.select().from(connectionRequestsTable)
    .where(eq(connectionRequestsTable.fromVcn, myVcn));
  res.json(requests);
});

export default router;
