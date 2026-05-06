import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { statusPostsTable, contactsTable } from "@workspace/db";
import {
  ListContactStatusParams,
  ListContactStatusResponseItem,
  GetStatusFeedResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts/:id/status", async (req, res): Promise<void> => {
  const params = ListContactStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const posts = await db.select().from(statusPostsTable)
    .where(eq(statusPostsTable.contactId, params.data.id))
    .orderBy(desc(statusPostsTable.createdAt))
    .limit(20);

  res.json(posts.map(p => ListContactStatusResponseItem.parse({
    id: p.id,
    contactId: p.contactId,
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.get("/status/feed", async (req, res): Promise<void> => {
  const posts = await db.select({
    id: statusPostsTable.id,
    contactId: statusPostsTable.contactId,
    content: statusPostsTable.content,
    imageUrl: statusPostsTable.imageUrl,
    createdAt: statusPostsTable.createdAt,
    contactName: contactsTable.name,
    contactAvatarUrl: contactsTable.avatarUrl,
  })
    .from(statusPostsTable)
    .innerJoin(contactsTable, eq(statusPostsTable.contactId, contactsTable.id))
    .orderBy(desc(statusPostsTable.createdAt))
    .limit(50);

  res.json(posts.map(p => GetStatusFeedResponseItem.parse({
    id: p.id,
    contactId: p.contactId,
    contactName: p.contactName,
    contactAvatarUrl: p.contactAvatarUrl ?? null,
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

export default router;
