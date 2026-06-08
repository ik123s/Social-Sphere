import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const connectionRequestsTable = pgTable("connection_requests", {
  id: serial("id").primaryKey(),
  fromVcn: text("from_vcn").notNull().references(() => usersTable.vcn),
  toVcn: text("to_vcn").notNull().references(() => usersTable.vcn),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export type ConnectionRequest = typeof connectionRequestsTable.$inferSelect;
