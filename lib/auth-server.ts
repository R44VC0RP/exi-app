import { auth } from "./auth";
import { headers } from "next/headers";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  return session;
}

export async function requireAuth() {
  const session = await getServerSession();
  
  if (!session) {
    throw new Error("Authentication required");
  }
  
  return session;
}

