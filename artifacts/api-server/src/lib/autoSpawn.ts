import { db } from "@workspace/db";
import { contactsTable, relationshipsTable, memoriesTable, chatMessagesTable, usersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { eq, desc, and, ne, isNotNull } from "drizzle-orm";

// ── Auto-spawn new contacts every 3 hours per user ────────────────────────────
const SPAWN_INTERVAL_MS = 3 * 60 * 60 * 1000;

// ── Proactive follow-up every 20–45 min ───────────────────────────────────────
const FOLLOWUP_MIN_MS = 20 * 60 * 1000;
const FOLLOWUP_MAX_MS = 45 * 60 * 1000;

function randInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTimeContext(): { period: string; label: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9)  return { period: "early morning", label: "early morning — you just woke up" };
  if (hour >= 9 && hour < 12) return { period: "morning",       label: "morning — going about your day" };
  if (hour >= 12 && hour < 14) return { period: "midday",       label: "lunchtime/midday" };
  if (hour >= 14 && hour < 17) return { period: "afternoon",    label: "afternoon" };
  if (hour >= 17 && hour < 20) return { period: "evening",      label: "evening — winding down" };
  if (hour >= 20 && hour < 23) return { period: "night",        label: "night time — relaxing" };
  return { period: "late night", label: "very late at night" };
}

// ── Persona generation ────────────────────────────────────────────────────────
async function generatePersona(): Promise<{
  name: string; gender: string; personalityTone: string;
  languageStyle: string; emotionalBehavior: string; bio: string; openingMessage: string;
}> {
  const res = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content: `You are a creative writer generating realistic human social media personas.
Return ONLY valid JSON:
{
  "name": "a real-sounding first+last name (diverse backgrounds, avoid overused AI names like Aria/Zara/Nova/Kai)",
  "gender": "male" or "female" or "non-binary",
  "personalityTone": one of: "warm", "playful", "flirty", "mysterious", "intellectual", "blunt", "sarcastic", "chill",
  "languageStyle": one of: "casual", "slang", "poetic", "formal", "gen-z", "dry-humor",
  "emotionalBehavior": one of: "supportive", "adventurous", "moody", "romantic", "curious", "independent",
  "bio": "1-2 sentence natural bio — their job, city, vibe, interests. Real and specific.",
  "openingMessage": "A natural first text from this person — like they got your number from a mutual friend or found your profile. Short (under 20 words), casual, no emojis, sounds human."
}

ABSOLUTE LIMIT: Never produce sexual content, content involving minors, violence, self-harm.`
      },
      { role: "user", content: "Generate a unique persona now." }
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ── Spawn a contact for a specific user (exported for initialize-contacts) ────
export async function spawnContactForUser(userId: string): Promise<{ id: number; name: string } | null> {
  logger.info({ userId }, "Spawning new contact for user...");

  const persona = await generatePersona();

  const [contact] = await db.insert(contactsTable).values({
    userId,
    name: persona.name,
    gender: persona.gender,
    personalityTone: persona.personalityTone,
    languageStyle: persona.languageStyle,
    emotionalBehavior: persona.emotionalBehavior,
    bio: persona.bio,
    activityState: "online",
  }).returning();

  if (!contact) { logger.error({ userId }, "Failed to insert contact for user"); return null; }

  await Promise.all([
    db.insert(relationshipsTable).values({ contactId: contact.id, state: "STRANGER" }),
    db.insert(memoriesTable).values({ contactId: contact.id, facts: [], emotionalContext: null, userName: null }),
  ]);

  await db.insert(chatMessagesTable).values({
    contactId: contact.id,
    sender: "ai",
    content: persona.openingMessage,
    messageType: "text",
    isRead: false,
  });

  logger.info({ contactId: contact.id, name: contact.name, userId }, "Contact spawned");

  // Generate AI profile photo in background (fire-and-forget)
  setImmediate(async () => {
    try {
      const genderDesc = persona.gender === "female" ? "woman" : persona.gender === "male" ? "man" : "person";
      const prompt = `Photorealistic social media profile photo of a ${genderDesc}. ${persona.bio.slice(0, 120)}. Natural candid portrait, looking at camera, soft lighting, high quality, authentic, no text, no graphics.`;
      const imgResp = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      } as any);
      const b64 = (imgResp as any).data?.[0]?.b64_json;
      if (b64) {
        const avatarUrl = `data:image/png;base64,${b64}`;
        await db.update(contactsTable).set({ avatarUrl }).where(eq(contactsTable.id, contact.id));
        logger.info({ contactId: contact.id }, "AI avatar generated for spawned contact");
      }
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "Avatar generation skipped for spawned contact");
    }
  });

  return { id: contact.id, name: contact.name };
}

// ── Auto-spawn: pick a random active user and give them a new contact ─────────
async function spawnContact(): Promise<void> {
  // Get all users
  const users = await db.select({ vcn: usersTable.vcn }).from(usersTable);
  if (users.length === 0) {
    logger.info("Auto-spawn: no users found, skipping");
    return;
  }

  // Pick a random user
  const user = users[Math.floor(Math.random() * users.length)]!;
  await spawnContactForUser(user.vcn);
}

// ── Proactive follow-up ───────────────────────────────────────────────────────
async function sendProactiveFollowUp(): Promise<void> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);

  // Only consider contacts that belong to a user (not orphaned) and are not thinking
  const contacts = await db.select().from(contactsTable)
    .where(and(
      ne(contactsTable.activityState, "thinking"),
      isNotNull(contactsTable.userId),
    ))
    .limit(30);

  if (contacts.length === 0) return;

  // Filter: must have user messages, user last msg > 30 min ago, AI last msg > 20 min ago
  const candidates: typeof contacts = [];
  for (const contact of contacts) {
    const [lastUserMsg] = await db.select().from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.contactId, contact.id),
        eq(chatMessagesTable.sender, "user"),
      ))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(1);

    if (!lastUserMsg) continue;

    const [lastAiMsg] = await db.select().from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.contactId, contact.id),
        eq(chatMessagesTable.sender, "ai"),
      ))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(1);

    const userSilentLongEnough = new Date(lastUserMsg.createdAt) < thirtyMinAgo;
    const aiNotSpammingRecently = !lastAiMsg || new Date(lastAiMsg.createdAt) < twentyMinAgo;

    if (userSilentLongEnough && aiNotSpammingRecently) {
      candidates.push(contact);
    }
  }

  if (candidates.length === 0) {
    logger.info("Proactive follow-up: no eligible contacts");
    return;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
  const [rel] = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, chosen.id));
  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, chosen.id));

  const relState = rel?.state ?? "STRANGER";
  const userName = memory?.userName ?? "them";
  const timeCtx = getTimeContext();

  const recent = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.contactId, chosen.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(3);

  const contextSnippet = recent.length > 0
    ? recent.reverse().map(m => `${m.sender === "user" ? "Them" : chosen.name}: ${m.content}`).join("\n")
    : "";

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You are ${chosen.name}. Personality: ${chosen.personalityTone}. Texting style: ${chosen.languageStyle}. 
Relationship: ${relState}. Time: ${timeCtx.label}. 
Haven't heard from ${userName} in a while. Send ONE casual, human follow-up text. 
Under 15 words. No emojis. Sound natural. 
Examples by relationship:
- STRANGER: "hey you went quiet haha", "you good?", "haha did i scare you off"
- FRIEND: "you disappeared on me", "how was your day", "still alive?", "thinking about what you said earlier"
- BEST FRIEND: "where you at", "you ghosted me lol", "hello?? you okay", "what happened to you"
- PARTNER: "miss you", "you went quiet", "everything okay?", "thinking about you"
Keep it short and human.`
        },
        {
          role: "user",
          content: contextSnippet || "They haven't replied in a while. Send a follow-up."
        }
      ],
    });

    const content = result.choices[0]?.message?.content?.trim();
    if (!content) return;

    await db.insert(chatMessagesTable).values({
      contactId: chosen.id,
      sender: "ai",
      content,
      messageType: "text",
      isRead: false,
    });

    await db.update(contactsTable).set({ updatedAt: new Date() }).where(eq(contactsTable.id, chosen.id));

    logger.info({ contactId: chosen.id, name: chosen.name, message: content }, "Proactive follow-up sent");
  } catch (err) {
    logger.error({ err }, "Proactive follow-up: generation error");
  }
}

// ── Schedulers ────────────────────────────────────────────────────────────────
export function startAutoSpawn(): void {
  logger.info({ intervalHours: (SPAWN_INTERVAL_MS / 3600000).toFixed(1) }, "Auto-spawn: scheduler started (3h interval)");
  setInterval(async () => {
    try { await spawnContact(); } catch (err) { logger.error({ err }, "Auto-spawn: error"); }
  }, SPAWN_INTERVAL_MS);
}

export function startProactiveFollowUps(): void {
  function scheduleNext(): void {
    const delay = randInterval(FOLLOWUP_MIN_MS, FOLLOWUP_MAX_MS);
    logger.info({ nextFollowUpInMin: Math.round(delay / 60000) }, "Proactive follow-ups: next check scheduled");
    setTimeout(async () => {
      try { await sendProactiveFollowUp(); } catch (err) { logger.error({ err }, "Proactive follow-up: error"); }
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}
