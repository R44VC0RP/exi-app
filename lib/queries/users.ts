import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user, type SelectUser, type InsertUser } from '../schema';

export async function getUserById(id: string): Promise<SelectUser | null> {
  const result = await db.select().from(user).where(eq(user.id, id));
  return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<SelectUser | null> {
  const result = await db.select().from(user).where(eq(user.email, email));
  return result[0] || null;
}

export async function createUser(data: InsertUser): Promise<SelectUser> {
  const result = await db.insert(user).values(data).returning();
  return result[0];
}

export async function updateUser(id: string, data: Partial<Omit<SelectUser, 'id'>>) {
  await db.update(user).set(data).where(eq(user.id, id));
}

export async function deleteUser(id: string) {
  await db.delete(user).where(eq(user.id, id));
}

