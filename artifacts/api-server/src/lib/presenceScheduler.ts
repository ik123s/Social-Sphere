import { db } from "@workspace/db";
import { contactsTable, chatMessagesTable, memoriesTable, relationshipsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, desc, and, ne } from "drizzle-orm";
import { logger } from "./logger";

type PresenceState = "online" | "idle" | "offline" | "sleeping";

const TICK_MIN_MS = 8 * 60 * 1000;   // 8 min
const TICK_MAX_MS = 18 * 60 * 1000;  // 18 min

// ── Time-based state weights ──────────────────────────────────────────────────
function getStateWeights(hour: number, tone: string): Record<PresenceState, number> {
  // Night owls (sarcastic, mysterious, moody) stay up later
  const nightOwl = ["sarcastic", "mysterious", "moody"].includes(tone);
  const morningPerson = ["warm", "playful", "intellectual"].includes(tone);

  if (hour >= 0 && hour < 4)  return { online: nightOwl ? 15 : 3, idle: 5,  offline: 10, sleeping: nightOwl ? 70 : 82 };
  if (hour >= 4 && hour < 7)  return { online: morningPerson ? 20 : 8, idle: 10, offline: 30, sleeping: morningPerson ? 40 : 52 };
  if (hour >= 7 && hour < 9)  return { online: 40, idle: 20, offline: 25, sleeping: 15 };
  if (hour >= 9 && hour < 12) return { online: 60, idle: 22, offline: 16, sleeping: 2  };
  if (hour >= 12 && hour < 14) return { online: 45, idle: 20, offline: 30, sleeping: 5 };
  if (hour >= 14 && hour < 18) return { online: 58, idle: 22, offline: 18, sleeping: 2 };
  if (hour >= 18 && hour < 21) return { online: 52, idle: 22, offline: 22, sleeping: 4 };
  if (hour >= 21 && hour < 23) return { online: 38, idle: 18, offline: 32, sleeping: 12 };
  return { online: 20, idle: 10, offline: 38, sleeping: 32 }; // 23:00–00:00
}

function pickState(weights: Record<PresenceState, number>): PresenceState {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (const [state, weight] of Object.entries(weights) as [PresenceState, number][]) {
    rand -= weight;
    if (rand <= 0) return state;
  }
  return "online";
}

// ── "Just got back" message ───────────────────────────────────────────────────
async function sendReturnMessage(
  contact: { id: number; name: string; personalityTone: string; languageStyle: string; bio: string | null },
  wasState: string,
): Promise<void> {
  // 55% chance to send a return message
  if (Math.random() > 0.55) return;

  // Check if there are user messages that went unanswered while offline
  const [lastUserMsg] = await db.select().from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.contactId, contact.id), eq(chatMessagesTable.sender, "user")))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(1);

  if (!lastUserMsg) return; // No prior conversation to return to

  const [rel] = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, contact.id));
  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, contact.id));
  const relState = rel?.state ?? "STRANGER";
  const userName = memory?.userName ?? "them";

  const reason = wasState === "sleeping"
    ? "sleeping/just woke up"
    : "been offline — busy, in the middle of something, or away from phone";

  const hour = new Date().getHours();
  const timeCtx = hour < 9 ? "morning" : hour < 17 ? "daytime" : "evening";

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You are ${contact.name}. Personality: ${contact.personalityTone}. Language style: ${contact.languageStyle}. Relationship: ${relState}. You just came back after ${reason}. It's ${timeCtx}. Send ONE very short, natural text message letting ${userName} know you're back or following up. Under 15 words. No emojis. Sound human.
Examples:
- "just got back, what did I miss"
- "sorry was knocked out lol, what's good"
- "back now, my phone was on silent"
- "had to deal with some stuff, hi again"
- "morning, slept longer than I meant to"
- "okay I'm back now"
Keep it casual and brief.`,
        },
        { role: "user", content: `Last thing they said: "${lastUserMsg.content}". Write your return message.` },
      ],
    });

    const content = res.choices[0]?.message?.content?.trim();
    if (!content) return;

    await db.insert(chatMessagesTable).values({
      contactId: contact.id,
      sender: "ai",
      content,
      messageType: "text",
      isRead: false,
    });

    await db.update(contactsTable).set({ updatedAt: new Date() }).where(eq(contactsTable.id, contact.id));
    logger.info({ contactId: contact.id, name: contact.name }, "Presence: sent return-online message");
  } catch (err) {
    logger.error({ err }, "Presence: failed to send return message");
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────
async function presenceTick(): Promise<void> {
  const hour = new Date().getHours();

  const contacts = await db.select().from(contactsTable)
    .where(ne(contactsTable.activityState, "thinking"));

  // Shuffle and only process a random subset per tick (3–6 contacts)
  const shuffled = contacts.sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, Math.min(shuffled.length, 3 + Math.floor(Math.random() * 4)));

  for (const contact of batch) {
    const current = contact.activityState as PresenceState | "thinking";
    if (current === "thinking") continue;

    const weights = getStateWeights(hour, contact.personalityTone);

    // Inertia: reduce chance to transition away from current (makes presence more stable)
    const inertia = 0.65; // 65% chance to stay (keep the state stable)
    if (Math.random() < inertia) continue;

    // Extra inertia for sleeping during sleep hours
    if (current === "sleeping" && hour >= 22) continue;
    if (current === "sleeping" && hour >= 0 && hour < 7 && Math.random() > 0.2) continue;

    const newState = pickState(weights);
    if (newState === current) continue;

    try {
      await db.update(contactsTable)
        .set({ activityState: newState, updatedAt: new Date() })
        .where(eq(contactsTable.id, contact.id));

      logger.info({ contactId: contact.id, name: contact.name, from: current, to: newState }, "Presence: state changed");

      // If coming back online from offline/sleeping, sometimes send a return message
      if ((current === "offline" || current === "sleeping") && newState === "online") {
        // Small async delay before sending return message (feels natural)
        const delay = 5000 + Math.random() * 15000;
        setTimeout(() => {
          sendReturnMessage(contact, current).catch(() => {});
        }, delay);
      }
    } catch (err) {
      logger.error({ err, contactId: contact.id }, "Presence: failed to update state");
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export function startPresenceScheduler(): void {
  function scheduleNext(): void {
    const delay = TICK_MIN_MS + Math.floor(Math.random() * (TICK_MAX_MS - TICK_MIN_MS));
    logger.info({ nextTickInMin: Math.round(delay / 60000) }, "Presence scheduler: next tick");
    setTimeout(async () => {
      try { await presenceTick(); } catch (err) { logger.error({ err }, "Presence tick error"); }
      scheduleNext();
    }, delay);
  }

  // Initial tick after 2 minutes (let server warm up)
  setTimeout(async () => {
    try { await presenceTick(); } catch { /* ignore */ }
    scheduleNext();
  }, 2 * 60 * 1000);

  logger.info("Presence scheduler: started");
}
