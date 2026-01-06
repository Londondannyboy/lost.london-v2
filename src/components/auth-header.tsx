"use client";

import { UserButton } from "@neondatabase/neon-js/auth/react/ui";

export function AuthHeader() {
  return (
    <header className="absolute top-4 right-4 z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-full px-1 py-1 shadow-lg">
        <UserButton />
      </div>
    </header>
  );
}
