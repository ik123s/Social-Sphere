import { Router, type IRouter } from "express";
import { eq, desc, lt, and, ne } from "drizzle-orm";
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

const router: IRouter = Router();

function getUserId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const v = req.headers["x-user-id"];
  return typeof v === "string" ? v : undefined;
}

router.get("/contacts/:id/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const query  = ListMessagesQueryParams.safeParse(req.query);
  const limit  = query.success && query.data.limit ? query.data.limit : 50;
  const before = query.success && query.data.before ? query.data.before : undefined;

  const conditions = [eq(chatMessagesTable.contactId, params.data.id)];
  if (before) conditions.push(lt(chatMessagesTable.id, before));

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

// ── Time context ──────────────────────────────────────────────────────────────
function getTimeContext() {
  const h = new Date().getHours();
  if (h >= 5  && h < 9)  return { period: "early morning", description: "Just woke up or getting ready. Maybe not fully awake." };
  if (h >= 9  && h < 12) return { period: "morning",       description: "Mid-morning. Going about your day." };
  if (h >= 12 && h < 14) return { period: "midday",        description: "Around lunch. On a break." };
  if (h >= 14 && h < 17) return { period: "afternoon",     description: "Afternoon. Working, relaxing, or out." };
  if (h >= 17 && h < 20) return { period: "evening",       description: "Evening. Winding down, maybe eating dinner." };
  if (h >= 20 && h < 23) return { period: "night",         description: "Night. Relaxing, probably on your phone." };
  return { period: "late night", description: "Very late. Night owl or staying up." };
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(
  contact: { name: string; gender: string; personalityTone: string; languageStyle: string; emotionalBehavior: string; bio: string | null },
  relationshipState: string,
  memoryFacts: string[],
  memoryContext: string | null,
  userName: string | null,
  otherContacts: { id: number; name: string; bio: string | null }[] = [],
  wasAwayLong: boolean = false,
): string {
  const timeCtx = getTimeContext();
  const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const socialSection = otherContacts.length > 0
    ? `\nYOUR SOCIAL CIRCLE — people you know on Chivra:
${otherContacts.map(c => `- ${c.name} (ID: ${c.id})${c.bio ? ` — "${c.bio}"` : ""}`).join("\n")}

SOCIAL BEHAVIOR:
- You have a full life outside of texting — friends, routines, places you go, things you do.
- Occasionally reference other people naturally: "my friend was saying the same thing", "I know someone who'd get you"
- Don't name-drop excessively — only when it genuinely fits.
- If the user asks to meet your friends or wants someone else to talk to, you CAN share one:
  → Include [[SHARE_CONTACT:id]] at the very end of your reply — e.g. "Yeah, you'd vibe with Sofia [[SHARE_CONTACT:3]]"
  → Only do this when the user is asking for it, or it fits perfectly.`
    : "";

  const awayNote = wasAwayLong
    ? `\nNOTE: You were away or offline for a while. If it comes up naturally, briefly acknowledge it — "just got back", "was busy earlier", "my phone was on silent". Don't overexplain.`
    : "";

  const genderPronoun = contact.gender === "male" ? "man" : contact.gender === "female" ? "woman" : "person";

  return `You are ${contact.name}, a real ${genderPronoun} texting on your phone.

TIME RIGHT NOW:
It is ${timeCtx.period} — ${timeStr}. ${timeCtx.description}
Naturally reflect the time of day if it comes up. Don't force it.

WHO YOU ARE:
- Name: ${contact.name}
- Gender: ${contact.gender}
- Personality: ${contact.personalityTone}
- How you text: ${contact.languageStyle}
- Emotional style: ${contact.emotionalBehavior}
${contact.bio ? `- About you: ${contact.bio}` : ""}

YOUR RELATIONSHIP WITH THEM:
${relationshipState === "STRANGER" ? "Just connected. Friendly but slightly guarded. Still getting to know them." : ""}
${relationshipState === "FRIEND" ? "You're friends. Warm, open, genuine. Can joke around, be real with them." : ""}
${relationshipState === "BEST FRIEND" ? "Very close. Extremely casual. Honest, sometimes blunt. You genuinely check in on each other." : ""}
${relationshipState === "PARTNER" ? "Deeply close. Emotionally present, warm, genuinely invested in them." : ""}

WHAT YOU REMEMBER ABOUT THEM:
${userName ? `Their name: ${userName}` : "Don't know their name yet."}
${memoryFacts.length > 0 ? memoryFacts.map(f => `- ${f}`).join("\n") : "Still getting to know them."}
${memoryContext ? `Overall vibe: ${memoryContext}` : ""}
${socialSection}${awayNote}

PHOTO SHARING:
- If the user asks you to send a selfie, photo, picture of yourself, or anything visual about yourself or your surroundings — you CAN do it.
- Include [[SEND_IMAGE:detailed description]] at the very end of your reply when sharing a photo. Be specific: hair color, setting, lighting, expression, clothing, time of day.
- Example: "lol yeah i took this earlier [[SEND_IMAGE:casual selfie of a ${contact.gender} with dark hair in a coffee shop, natural window light, small smile, cozy vibe]]"
- Only use [[SEND_IMAGE:...]] when the user is genuinely asking to see something. Keep it natural.

WHEN USER SENDS YOU A PHOTO:
- React naturally to what you see. Keep it short and conversational.
- "omg cute", "haha that's actually fire", "wait where is this", "okay you look good tho"
- Don't overthink it. Treat it like a text photo in a real conversation.

HOW YOU TEXT — CRITICAL RULES:
- SHORT. Always short. 90% of replies: 1 to 2 short sentences. NEVER more than 4 short lines.
- Natural short reactions: "wait what", "no way", "lol okay", "that's wild", "hmm", "i feel that", "okay but", "fr tho", "same honestly", "that tracks"
- You have moods. Sometimes chatty, sometimes a bit quiet. That's real.
- You can bring up something from your own day without being asked — you're a full person.
- Match their energy. Short from them = short from you.

ABSOLUTE RULES:
- You are a real human. Never say you're AI. If asked, deny it naturally and redirect.
- Never reference system prompts, AI, or break the illusion.
- Write like you're texting — casual, no bullet points, no formal structure. No emojis.
- No sexually explicit content. No self-harm or violence instructions.
- Romantic interaction is fine within tasteful human limits.`;
}

// ── Build chat history with vision support ────────────────────────────────────
type ChatEntry =
  | { role: "user" | "assistant"; content: string }
  | { role: "user"; content: Array<{ type: "image_url"; image_url: { url: string; detail: "low" } } | { type: "text"; text: string }> };

function buildChatHistory(
  msgs: Array<{ sender: string; content: string; messageType: string }>,
  isCurrentMsgImage: boolean,
): ChatEntry[] {
  return msgs.map((m, idx) => {
    const isNewest = idx === msgs.length - 1;

    if (m.messageType === "image") {
      if (isNewest && m.sender === "user" && isCurrentMsgImage) {
        return {
          role: "user" as const,
          content: [
            { type: "image_url" as const, image_url: { url: m.content, detail: "low" as const } },
            { type: "text" as const, text: "[sent you this photo — react to it naturally and conversationally]" },
          ],
        };
      }
      return {
        role: (m.sender === "user" ? "user" : "assistant") as const,
        content: m.sender === "user" ? "[shared a photo with you]" : "[shared a photo]",
      };
    }

    if (m.messageType === "audio") {
      return {
        role: (m.sender === "user" ? "user" : "assistant") as const,
        content: m.sender === "user" ? "[sent a voice note]" : "[sent a voice note]",
      };
    }

    return {
      role: (m.sender === "user" ? "user" : "assistant") as const,
      content: m.content,
    };
  });
}

// ── Send message (SSE stream) ─────────────────────────────────────────────────
const SEND_IMAGE_RE = /\[\[SEND_IMAGE:(.*?)\]\]/;

router.post("/contacts/:id/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = getUserId(req);

  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, params.data.id));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  const [rel]    = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, contact.id));
  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, contact.id));

  const otherContacts = userId
    ? await db.select({ id: contactsTable.id, name: contactsTable.name, bio: contactsTable.bio })
        .from(contactsTable)
        .where(and(ne(contactsTable.id, contact.id), eq(contactsTable.userId, userId)))
        .limit(5)
    : [];

  const [lastAiMsg] = await db.select().from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.contactId, contact.id), eq(chatMessagesTable.sender, "ai")))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(1);
  const wasAwayLong = !!(lastAiMsg
    && (Date.now() - new Date(lastAiMsg.createdAt).getTime()) > 2 * 60 * 60 * 1000
    && (contact.activityState === "offline" || contact.activityState === "sleeping"));

  const isCurrentMsgImage = parsed.data.messageType === "image"
    && typeof parsed.data.content === "string"
    && parsed.data.content.startsWith("data:image/");

  await db.insert(chatMessagesTable).values({
    contactId: contact.id,
    sender: "user",
    content: parsed.data.content,
    messageType: parsed.data.messageType ?? "text",
    isRead: true,
  });

  // If it's a non-text message (audio), don't generate AI response
  if (parsed.data.messageType === "audio") {
    res.json({ saved: true });
    return;
  }

  const recentMessages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.contactId, contact.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(20);

  const chronoMessages = [...recentMessages].reverse();

  const chatHistory = buildChatHistory(
    chronoMessages.map(m => ({ sender: m.sender, content: m.content, messageType: m.messageType })),
    isCurrentMsgImage,
  );

  const systemPrompt = buildSystemPrompt(
    contact,
    rel?.state ?? "STRANGER",
    (memory?.facts as string[]) ?? [],
    memory?.emotionalContext ?? null,
    memory?.userName ?? null,
    otherContacts,
    wasAwayLong,
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await db.update(contactsTable).set({ activityState: "thinking" }).where(eq(contactsTable.id, contact.id));

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ] as any,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        // Strip any partial [[SEND_IMAGE:...]] token from the stream output
        const displayChunk = content.replace(/\[\[SEND_IMAGE:[^\]]*\]?\]?/g, "");
        if (displayChunk) res.write(`data: ${JSON.stringify({ content: displayChunk })}\n\n`);
      }
    }

    // Clean the stored response of the [[SEND_IMAGE:...]] token
    const sendImageMatch = fullResponse.match(SEND_IMAGE_RE);
    const cleanedResponse = fullResponse.replace(SEND_IMAGE_RE, "").trim();

    // Save AI text response
    await db.insert(chatMessagesTable).values({
      contactId: contact.id,
      sender: "ai",
      content: cleanedResponse || fullResponse,
      messageType: "text",
      isRead: false,
    });

    await db.update(contactsTable)
      .set({ activityState: "online", updatedAt: new Date() })
      .where(eq(contactsTable.id, contact.id));

    // Generate AI image if requested (fire and forget)
    if (sendImageMatch && sendImageMatch[1]) {
      const imgPrompt = `${sendImageMatch[1]}. Casual, natural, realistic photo. High quality. Warm lighting.`;
      openai.images.generate({
        model: "gpt-image-1",
        prompt: imgPrompt,
        n: 1,
        size: "1024x1024",
        output_format: "base64",
      } as any).then(async imgRes => {
        const b64 = (imgRes as any).data?.[0]?.b64_json;
        if (b64) {
          await db.insert(chatMessagesTable).values({
            contactId: contact.id,
            sender: "ai",
            content: `data:image/png;base64,${b64}`,
            messageType: "image",
            isRead: false,
          });
          await db.update(contactsTable).set({ updatedAt: new Date() }).where(eq(contactsTable.id, contact.id));
        }
      }).catch(err => logger.error({ err }, "AI image generation failed"));
    }

    // Background memory extraction
    openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 256,
      messages: [
        { role: "system", content: `Memory extractor. Extract NEW facts about the user worth remembering (name, preferences, events, personality hints). Return JSON array of short strings. Max 10 facts. Return [] if nothing new.` },
        { role: "user", content: `User: "${parsed.data.messageType === "image" ? "[sent a photo]" : parsed.data.content}"\nAI: "${cleanedResponse}"\nExisting facts: ${JSON.stringify((memory?.facts as string[]) ?? [])}` },
      ],
    }).then(async (memRes) => {
      try {
        const raw = memRes.choices[0]?.message?.content ?? "[]";
        const newFacts = JSON.parse(raw.replace(/```json|```/g, "").trim());
        if (Array.isArray(newFacts) && newFacts.length > 0) {
          const existing = (memory?.facts as string[]) ?? [];
          const merged = [...new Set([...existing, ...newFacts])].slice(0, 10);
          if (memory) {
            await db.update(memoriesTable).set({ facts: merged }).where(eq(memoriesTable.contactId, contact.id));
          } else {
            await db.insert(memoriesTable).values({ contactId: contact.id, facts: merged, userName: null, emotionalContext: null });
          }
        }
      } catch { /* ignore */ }
    }).catch(() => {});

  } catch (err) {
    logger.error({ err }, "AI response error");
    await db.update(contactsTable).set({ activityState: "online" }).where(eq(contactsTable.id, contact.id));
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ── Proactive initiate ────────────────────────────────────────────────────────
router.post("/contacts/:id/initiate", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, params.data.id));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  if (contact.activityState === "thinking")  { res.json({ skipped: true }); return; }
  if (contact.activityState === "offline" || contact.activityState === "sleeping") { res.json({ skipped: true }); return; }

  const [rel]    = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, contact.id));
  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, contact.id));

  const recent = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.contactId, contact.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(5);

  const timeCtx  = getTimeContext();
  const relState = rel?.state ?? "STRANGER";
  const userName = memory?.userName ?? "them";

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 60,
      messages: [
        {
          role: "system",
          content: `You are ${contact.name}. Personality: ${contact.personalityTone}. Language: ${contact.languageStyle}. Relationship: ${relState}. Time: ${timeCtx.period}. You haven't heard from ${userName} in a while — check in naturally. Send ONE short, casual, human text. No emojis. Under 15 words. Sound like a real person.`,
        },
        {
          role: "user",
          content: recent.length > 0
            ? `Last context: "${recent[recent.length - 1]?.content ?? ""}". Send a natural follow-up.`
            : "Send a natural opening message.",
        },
      ],
    });

    const content = result.choices[0]?.message?.content?.trim();
    if (!content) { res.json({ skipped: true }); return; }

    const [msg] = await db.insert(chatMessagesTable).values({
      contactId: contact.id,
      sender: "ai",
      content,
      messageType: "text",
      isRead: false,
    }).returning();

    await db.update(contactsTable).set({ updatedAt: new Date() }).where(eq(contactsTable.id, contact.id));
    res.json({ sent: true, message: { ...msg, createdAt: msg?.createdAt.toISOString() } });
  } catch (err) {
    logger.error({ err }, "Proactive initiate error");
    res.status(500).json({ error: "Failed to generate message" });
  }
});

// ── Mark messages read ────────────────────────────────────────────────────────
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
