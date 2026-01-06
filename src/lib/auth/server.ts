import 'server-only';
import { createAuthServer } from '@neondatabase/neon-js/auth/next/server';

// Lazy initialization - only create auth server at runtime, not build time
let _authServer: ReturnType<typeof createAuthServer> | null = null;

export function getAuthServer() {
  if (!process.env.NEON_AUTH_BASE_URL) return null;
  if (!_authServer) {
    _authServer = createAuthServer();
  }
  return _authServer;
}
