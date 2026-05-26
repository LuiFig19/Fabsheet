"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Client SDK - used by the login form and the sign-out button. baseURL falls
// back to relative ("") which is fine for same-origin Next routes.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
