import 'server-only';
import { createAuthServer } from '@neondatabase/neon-js/auth/next/server';

// Only create auth server if NEON_AUTH_BASE_URL is configured
export const authServer = process.env.NEON_AUTH_BASE_URL
  ? createAuthServer()
  : null;
