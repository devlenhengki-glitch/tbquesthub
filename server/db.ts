import { and, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { academicEditorSessions, competitions, InsertUser, NewCompetition, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCompetitions() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(competitions);
}

export async function getCompetitionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  return rows[0];
}

export async function createCompetition(input: NewCompetition) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const inserted = await db.insert(competitions).values(input).$returningId();
  const id = inserted[0]?.id;
  if (typeof id !== "number") throw new Error("Competition was not created");
  const record = await getCompetitionById(id);
  if (!record) throw new Error("Competition record could not be loaded");
  return record;
}

export async function deleteExpiredCompetition(id: number, todayUtc: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(competitions).where(and(eq(competitions.id, id), lt(competitions.deadline, todayUtc)));
}

export async function createAcademicEditorSession(tokenHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(academicEditorSessions).where(lt(academicEditorSessions.expiresAt, new Date()));
  await db.insert(academicEditorSessions).values({ tokenHash, expiresAt });
}

export async function getAcademicEditorSession(tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(academicEditorSessions).where(eq(academicEditorSessions.tokenHash, tokenHash)).limit(1);
  return rows[0];
}

export async function deleteAcademicEditorSession(tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(academicEditorSessions).where(eq(academicEditorSessions.tokenHash, tokenHash));
}
