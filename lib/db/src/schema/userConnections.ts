import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userConnectionsTable = pgTable("user_connections", {
  id: serial("id").primaryKey(),
  initiatorVcn: text("initiator_vcn").notNull().references(() => usersTable.vcn),
  targetVcn: text("target_vcn").notNull().references(() => usersTable.vcn),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("unique_connection").on(t.initiatorVcn, t.targetVcn),
]);

export type UserConnection = typeof userConnectionsTable.$inferSelect;
