import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { relationshipsTable } from "@workspace/db";
import {
  GetRelationshipParams,
  UpdateRelationshipParams,
  UpdateRelationshipBody,
  GetRelationshipResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contacts/:id/relationship", async (req, res): Promise<void> => {
  const params = GetRelationshipParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [rel] = await db.select().from(relationshipsTable).where(eq(relationshipsTable.contactId, params.data.id));
  if (!rel) { res.status(404).json({ error: "Relationship not found" }); return; }

  res.json(GetRelationshipResponse.parse({
    contactId: rel.contactId,
    state: rel.state,
    updatedAt: rel.updatedAt.toISOString(),
  }));
});

router.patch("/contacts/:id/relationship", async (req, res): Promise<void> => {
  const params = UpdateRelationshipParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateRelationshipBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rel] = await db.update(relationshipsTable)
    .set({ state: parsed.data.state, updatedAt: new Date() })
    .where(eq(relationshipsTable.contactId, params.data.id))
    .returning();

  if (!rel) { res.status(404).json({ error: "Relationship not found" }); return; }

  res.json(GetRelationshipResponse.parse({
    contactId: rel.contactId,
    state: rel.state,
    updatedAt: rel.updatedAt.toISOString(),
  }));
});

export default router;
