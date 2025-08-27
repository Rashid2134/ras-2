import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const decryptionSessions = pgTable("decryption_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalText: text("original_text").notNull(),
  decodedText: text("decoded_text").notNull(),
  encryptionType: text("encryption_type").notNull(),
  originalLength: integer("original_length").notNull(),
  decodedLength: integer("decoded_length").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDecryptionSessionSchema = createInsertSchema(decryptionSessions).omit({
  id: true,
  createdAt: true,
});

export const decryptRequestSchema = z.object({
  text: z.string().min(1, "النص مطلوب"),
  encryptionType: z.enum(["auto", "decimal", "hex", "base64", "caesar", "rot13", "url"]).default("auto"),
  caesarShift: z.number().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type DecryptionSession = typeof decryptionSessions.$inferSelect;
export type InsertDecryptionSession = z.infer<typeof insertDecryptionSessionSchema>;
export type DecryptRequest = z.infer<typeof decryptRequestSchema>;
