"use client";

import { UserButton } from "@neondatabase/neon-js/auth/react/ui";

export function AuthHeader() {
  return (
    <header className="absolute top-0 right-0 p-4 z-50">
      <UserButton />
    </header>
  );
}
