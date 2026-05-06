import { db } from "@workspace/db";
import { contactsTable, relationshipsTable, memoriesTable, chatMessagesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000;
const MAX_INTERVAL_MS = 4 * 60 * 60 * 1000;

function randomInterval(): number {
  return Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)) + MIN_INTERVAL_MS;
}

async function generatePersona(): Promise<{
  name: string;
  gender: string;
  personalityTone: string;
  languageStyle: string;
  emotionalBehavior: string;
  bio: string;
  openingMessage: string;
}> {
  const res = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 400,
    messages: [
      {
        role: "system",
        content: `You are a creative writer. Generate a completely unique, realistic human persona for a social media contact. 
Return ONLY valid JSON with these exact fields:
{
  "name": "a real-sounding first name (diverse, not common AI names like Aria or Zara)",
  "gender": "male" or "female" or "non-binary",
  "personalityTone": one of: "warm", "playful", "flirty", "mysterious", "intellectual", "blunt", "sarcastic", "chill",
  "languageStyle": one of: "casual", "slang", "poetic", "formal", "gen-z", "dry-humor",
  "emotionalBehavior": one of: "supportive", "adventurous", "moody", "romantic", "curious", "independent",
  "bio": "a 1-2 sentence natural bio about this real-seeming person (their job, vibe, city, interests)",
  "openingMessage": "a natural first text message from this person to someone they just found/met — like they got the number from a mutual or saw them somewhere. Keep it short, casual, human. No emojis."
}`
      },
      {
        role: "user",
        content: "Generate a new unique persona now."
      }
    ]
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function spawnContact(): Promise<void> {
  logger.info("Auto-spawn: generating new contact persona...");

  const persona = await generatePersona();

  const [contact] = await db.insert(contactsTable).values({
    name: persona.name,
    gender: persona.gender,
    personalityTone: persona.personalityTone,
    languageStyle: persona.languageStyle,
    emotionalBehavior: persona.emotionalBehavior,
    bio: persona.bio,
    activityState: "online",
  }).returning();

  if (!contact) {
    logger.error("Auto-spawn: failed to insert contact");
    return;
  }

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

  logger.info({ contactId: contact.id, name: contact.name }, "Auto-spawn: new contact created");
}

export function startAutoSpawn(): void {
  function scheduleNext(): void {
    const delay = randomInterval();
    const hours = (delay / 3600000).toFixed(2);
    logger.info({ nextSpawnInHours: hours }, "Auto-spawn: next contact scheduled");

    setTimeout(async () => {
      try {
        await spawnContact();
      } catch (err) {
        logger.error({ err }, "Auto-spawn: error spawning contact");
      }
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}
