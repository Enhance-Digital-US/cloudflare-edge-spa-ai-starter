import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.js";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

// One instance per (user, conversation), addressed by name `${userId}:${conversationId}`,
// so a user can only ever reach their own conversations.
export class Conversation extends DurableObject<Env["Bindings"]> {
  constructor(ctx: DurableObjectState, env: Env["Bindings"]) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
    });
  }

  append(messages: Pick<StoredMessage, "role" | "content">[]): void {
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      for (const m of messages) {
        this.ctx.storage.sql.exec(
          "INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)",
          m.role,
          m.content,
          now,
        );
      }
    });
  }

  list(limit = 200): StoredMessage[] {
    return this.ctx.storage.sql
      .exec<{ role: StoredMessage["role"]; content: string; created_at: number }>(
        "SELECT role, content, created_at FROM messages ORDER BY id DESC LIMIT ?",
        limit,
      )
      .toArray()
      .reverse()
      .map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
  }

  // Deletes rows, not storage: deleteAll() would also drop the table that the
  // constructor created, breaking every later call on this instance.
  clear(): void {
    this.ctx.storage.sql.exec("DELETE FROM messages");
  }
}

export function conversationName(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}
