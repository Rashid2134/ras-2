import { type User, type InsertUser, type DecryptionSession, type InsertDecryptionSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createDecryptionSession(session: InsertDecryptionSession): Promise<DecryptionSession>;
  getDecryptionSessions(limit?: number): Promise<DecryptionSession[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private decryptionSessions: Map<string, DecryptionSession>;

  constructor() {
    this.users = new Map();
    this.decryptionSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDecryptionSession(insertSession: InsertDecryptionSession): Promise<DecryptionSession> {
    const id = randomUUID();
    const session: DecryptionSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.decryptionSessions.set(id, session);
    return session;
  }

  async getDecryptionSessions(limit: number = 10): Promise<DecryptionSession[]> {
    const sessions = Array.from(this.decryptionSessions.values());
    return sessions
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
