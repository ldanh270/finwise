import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import type { PrefixJsonStorage } from "./outbox-persistence";

/** Small key/value boundary backed by SQLite. The JSON values are workflow
 * snapshots; tokens are intentionally never passed to this adapter. */
export class SqliteJsonStorage implements PrefixJsonStorage {
  private databasePromise: Promise<SQLiteDatabase> | undefined;

  async getItem(key: string): Promise<string | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM finwise_kv WHERE key = ?",
      [key],
    );
    return row?.value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const database = await this.database();
    await database.runAsync(
      "INSERT INTO finwise_kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  async removeItem(key: string): Promise<void> {
    const database = await this.database();
    await database.runAsync("DELETE FROM finwise_kv WHERE key = ?", [key]);
  }

  async removeByPrefix(prefix: string): Promise<void> {
    const database = await this.database();
    const escapedPrefix = prefix.replace(/[\\%_]/g, "\\$&");
    await database.runAsync(
      "DELETE FROM finwise_kv WHERE key LIKE ? ESCAPE '\\'",
      [`${escapedPrefix}%`],
    );
  }

  private database(): Promise<SQLiteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openDatabaseAsync("finwise-mobile.db").then(
        async (database) => {
          await database.execAsync(
            "CREATE TABLE IF NOT EXISTS finwise_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
          );
          return database;
        },
      );
    }
    return this.databasePromise;
  }
}

export const sqliteJsonStorage = new SqliteJsonStorage();
