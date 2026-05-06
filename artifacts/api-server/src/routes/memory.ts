import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { memoriesTable } from "@workspace/db";
import { GetMemoryParams, GetMemoryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts/:id/memory", async (req, res): Promise<void> => {
  const params = GetMemoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.contactId, params.data.id));
  if (!memory) { res.status(404).json({ error: "Memory not found" }); return; }

  res.json(GetMemoryResponse.parse({
    contactId: memory.contactId,
    userName: memory.userName ?? null,
    facts: (memory.facts as string[]) ?? [],
    emotionalContext: memory.emotionalContext ?? null,
    updatedAt: memory.updatedAt.toISOString(),
  }));
});

export default router;
