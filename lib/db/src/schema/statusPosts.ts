import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contactsTable } from "./contacts";

export const statusPostsTable = pgTable("status_posts", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStatusPostSchema = createInsertSchema(statusPostsTable).omit({ id: true, createdAt: true });
export type InsertStatusPost = z.infer<typeof insertStatusPostSchema>;
export type StatusPost = typeof statusPostsTable.$inferSelect;
