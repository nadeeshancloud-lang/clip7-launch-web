import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const quotaWindows = sqliteTable("quota_windows", {
  uid: text("uid").primaryKey(),
  device: text("device").notNull(),
  allowance: integer("allowance").notNull(),
  generation: integer("generation").notNull().default(1),
  startedAt: integer("started_at"),
  used: integer("used").notNull().default(0),
});

export const downloadRecords = sqliteTable("download_records", {
  id: text("id").primaryKey(),
  uid: text("uid").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  generation: integer("generation").notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  formatId: text("format_id").notNull(),
  formatLabel: text("format_label").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  startedAt: integer("started_at"),
}, table => [
  uniqueIndex("download_request_identity").on(table.uid, table.idempotencyKey),
  index("download_user_generation").on(table.uid, table.generation, table.status),
  index("download_history").on(table.uid, table.createdAt),
]);
