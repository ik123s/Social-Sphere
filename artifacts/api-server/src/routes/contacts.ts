import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { contactsTable, relationshipsTable, chatMessagesTable, memoriesTable } from "@workspace/db";
import {
  CreateContactBody,
  GetContactParams,
  UpdateContactParams,
  UpdateContactBody,
  DeleteContactParams,
  GetContactActivityParams,
  GetContactResponse,
  GetContactActivityResponse,
  ListContactsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getUserId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const v = req.headers["x-user-id"];
  return typeof v === "string" ? v : undefined;
}

router.get("/contacts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.json([]); return; }

  const contacts = await db.select().from(contactsTable)
    .where(eq(contactsTable.userId, userId))
    .orderBy(desc(contactsTable.updatedAt));

  const summaries = await Promise.all(contacts.map(async (contact) => {
    const [rel] = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, contact.id));
    const [lastMsg] = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.contactId, contact.id))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(1);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(sql`${chatMessagesTable.contactId} = ${contact.id} AND ${chatMessagesTable.sender} = 'ai' AND ${chatMessagesTable.isRead} = false`);

    return ListContactsResponseItem.parse({
      id: contact.id,
      name: contact.name,
      gender: contact.gender,
      avatarUrl: contact.avatarUrl ?? null,
      activityState: contact.activityState,
      relationshipState: rel?.state ?? "STRANGER",
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      unreadCount: count ?? 0,
    });
  }));

  res.json(summaries);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contact] = await db.insert(contactsTable).values({
    userId,
    name: parsed.data.name,
    gender: parsed.data.gender,
    personalityTone: parsed.data.personalityTone,
    languageStyle: parsed.data.languageStyle,
    emotionalBehavior: parsed.data.emotionalBehavior,
    bio: parsed.data.bio ?? null,
    avatarUrl: parsed.data.avatarUrl ?? null,
  }).returning();

  await db.insert(relationshipsTable).values({ contactId: contact.id, state: "STRANGER" });
  await db.insert(memoriesTable).values({ contactId: contact.id, facts: [], userName: null, emotionalContext: null });

  res.status(201).json(GetContactResponse.parse(contact));
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const params = GetContactParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = getUserId(req);
  const conditions = [eq(contactsTable.id, params.data.id)];
  if (userId) conditions.push(eq(contactsTable.userId, userId));

  const [contact] = await db.select().from(contactsTable).where(and(...conditions));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  res.json(GetContactResponse.parse(contact));
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const params = UpdateContactParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = getUserId(req);
  const conditions = [eq(contactsTable.id, params.data.id)];
  if (userId) conditions.push(eq(contactsTable.userId, userId));

  const [contact] = await db.update(contactsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();

  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(GetContactResponse.parse(contact));
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = getUserId(req);
  const conditions = [eq(contactsTable.id, params.data.id)];
  if (userId) conditions.push(eq(contactsTable.userId, userId));

  const [deleted] = await db.delete(contactsTable).where(and(...conditions)).returning();
  if (!deleted) { res.status(404).json({ error: "Contact not found" }); return; }
  res.sendStatus(204);
});

// ── Find contact by ID (within the user's own ecosystem) ─────────────────────
router.get("/contacts/find/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid contact ID" }); return; }

  const userId = getUserId(req);
  const conditions = [eq(contactsTable.id, id)];
  if (userId) conditions.push(eq(contactsTable.userId, userId));

  const [contact] = await db.select().from(contactsTable).where(and(...conditions));
  if (!contact) { res.status(404).json({ error: "No contact found with that ID" }); return; }

  res.json(GetContactResponse.parse(contact));
});

router.get("/contacts/:id/activity", async (req, res): Promise<void> => {
  const params = GetContactActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = getUserId(req);
  const conditions = [eq(contactsTable.id, params.data.id)];
  if (userId) conditions.push(eq(contactsTable.userId, userId));

  const [contact] = await db.select().from(contactsTable).where(and(...conditions));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  res.json(GetContactActivityResponse.parse({
    id: contact.id,
    activityState: contact.activityState,
    lastSeenAt: contact.updatedAt?.toISOString() ?? null,
  }));
});

export default router;
