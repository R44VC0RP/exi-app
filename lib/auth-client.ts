import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://development.exon.dev' 
    : 'http://localhost:3000'
});

export const { 
  signIn, 
  signOut, 
  signUp, 
  useSession,
  getSession,
  $Infer
} = authClient;

