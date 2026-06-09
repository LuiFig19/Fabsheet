import { doublePrecision, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ocrCache = pgTable("OcrCache", {
  id: text("id").primaryKey(),
  fileHash: text("fileHash").notNull(),
  model: text("model").notNull(),
  resultJson: jsonb("resultJson").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const auditLog = pgTable("AuditLog", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId"),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  inputTokens: integer("inputTokens"),
  outputTokens: integer("outputTokens"),
  costUsd: doublePrecision("costUsd"),
  model: text("model"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
