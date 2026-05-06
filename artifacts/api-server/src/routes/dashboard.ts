import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactsTable, relationshipsTable, chatMessagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [{ totalContacts }] = await db.select({ totalContacts: sql<number>`count(*)::int` }).from(contactsTable);
  const [{ totalUnread }] = await db.select({ totalUnread: sql<number>`count(*)::int` }).from(chatMessagesTable)
    .where(sql`${chatMessagesTable.sender} = 'ai' AND ${chatMessagesTable.isRead} = false`);

  const rels = await db.select().from(relationshipsTable);
  const activeRelationships = rels.filter(r => r.state !== "STRANGER").length;
  const friendCount = rels.filter(r => r.state === "FRIEND" || r.state === "BEST FRIEND").length;
  const partnerCount = rels.filter(r => r.state === "PARTNER").length;

  const [{ onlineCount }] = await db.select({ onlineCount: sql<number>`count(*)::int` }).from(contactsTable)
    .where(eq(contactsTable.activityState, "online"));

  res.json(GetDashboardSummaryResponse.parse({
    totalContacts: totalContacts ?? 0,
    totalUnread: totalUnread ?? 0,
    activeRelationships,
    friendCount,
    partnerCount,
    onlineCount: onlineCount ?? 0,
  }));
});

export default router;
