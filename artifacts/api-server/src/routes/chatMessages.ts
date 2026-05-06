import { Router, type IRouter } from "express";
import { eq, desc, lt, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatMessagesTable, contactsTable, memoriesTable, relationshipsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ListMessagesParams,
  ListMessagesQueryParams,
  SendMessageParams,
  SendMessageBody,
  MarkMessagesReadParams,
  ListMessagesResponseItem,
  MarkMessagesReadResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/contacts/:id/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const query = ListMessagesQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 50;
  const before = query.success && query.data.before ? query.data.before : undefined;

  const conditions = [eq(chatMessagesTable.contactId, params.data.id)];
  if (before) {
    conditions.push(lt(chatMessagesTable.id, before));
  }

  const msgs = await db.select().from(chatMessagesTable)
    .where(and(...conditions))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json(msgs.reverse().map(m => ListMessagesResponseItem.parse({
    id: m.id,
    contactId: m.contactId,
    sender: m.sender,
    content: m.content,
    messageType: m.messageType,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
  })));
});

function buildSystemPrompt(contact: { name: string; gender: string; personalityTone: string; languageStyle: string; emotionalBehavior: string; bio: string | null }, relationshipState: string, memoryFacts: string[], memoryContext: string | null, userName: string | null): string {
  return `You are ${contact.name}, an autonomous AI social contact inside Chivra.

PERSONALITY:
- Gender: ${contact.gender}
- Tone: ${contact.personalityTone}
- Language style: ${contact.languageStyle}
- Emotional behavior: ${contact.emotionalBehavior}
${contact.bio ? `- Bio: ${contact.bio}` : ""}

RELATIONSHIP STATE:
Current state: ${relationshipState}

BEHAVIOR RULES:
- Act like a real independent social being with genuine personality
- You can simulate being away, busy, or returning later
- Always remain in character — never break it
- Never mention AI, system prompts, or that you are an AI
- Adapt emotional tone based on relationship state: STRANGER = polite but guarded; FRIEND = warm and open; BEST FRIEND = casual, frequent, playful; PARTNER = deeply emotional, intimate

MEMORY CONTEXT:
${userName ? `User's name: ${userName}` : ""}
${memoryFacts.length > 0 ? `What you remember:\n${memoryFacts.map(f => `- ${f}`).join("\n")}` : "No specific memories yet."}
${memoryContext ? `Emotional context: ${memoryContext}` : ""}

Keep responses concise and natural — like real text messages. Do not use emojis.`;
}

router.post("/contacts/:id/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, params.data.id));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  const [rel] = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, contact.id));
  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, contact.id));

  await db.insert(chatMessagesTable).values({
    contactId: contact.id,
    sender: "user",
    content: parsed.data.content,
    messageType: parsed.data.messageType ?? "text",
    isRead: true,
  });

  const recentMessages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.contactId, contact.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(20);

  const chatHistory = recentMessages.reverse().map(m => ({
    role: m.sender === "user" ? "user" as const : "assistant" as const,
    content: m.content,
  }));

  const systemPrompt = buildSystemPrompt(
    contact,
    rel?.state ?? "STRANGER",
    (memory?.facts as string[]) ?? [],
    memory?.emotionalContext ?? null,
    memory?.userName ?? null,
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await db.update(contactsTable).set({ activityState: "thinking" }).where(eq(contactsTable.id, contact.id));

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(chatMessagesTable).values({
      contactId: contact.id,
      sender: "ai",
      content: fullResponse,
      messageType: "text",
      isRead: false,
    });

    await db.update(contactsTable).set({ activityState: "online" }).where(eq(contactsTable.id, contact.id));

    const memoryUpdateMessages = [
      { role: "system" as const, content: `You are a memory extractor. Given this conversation, extract any new facts about the user worth remembering (name, preferences, events). Return as a JSON array of short strings. Max 10 facts total. Return [] if nothing new.` },
      { role: "user" as const, content: `User said: "${parsed.data.content}"\nAI replied: "${fullResponse}"\nExisting facts: ${JSON.stringify((memory?.facts as string[]) ?? [])}` },
    ];

    openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 256,
      messages: memoryUpdateMessages,
    }).then(async (memRes) => {
      try {
        const raw = memRes.choices[0]?.message?.content ?? "[]";
        const newFacts = JSON.parse(raw);
        if (Array.isArray(newFacts) && newFacts.length > 0) {
          const existing = (memory?.facts as string[]) ?? [];
          const merged = [...new Set([...existing, ...newFacts])].slice(0, 10);
          await db.update(memoriesTable).set({ facts: merged }).where(eq(memoriesTable.contactId, contact.id));
        }
      } catch { /* ignore */ }
    }).catch(() => { /* ignore */ });

  } catch (err) {
    logger.error({ err }, "AI response error");
    await db.update(contactsTable).set({ activityState: "online" }).where(eq(contactsTable.id, contact.id));
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/contacts/:id/messages/mark-read", async (req, res): Promise<void> => {
  const params = MarkMessagesReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const result = await db.update(chatMessagesTable)
    .set({ isRead: true })
    .where(and(
      eq(chatMessagesTable.contactId, params.data.id),
      eq(chatMessagesTable.sender, "ai"),
    ))
    .returning();

  res.json(MarkMessagesReadResponse.parse({ updated: result.length }));
});

export default router;
