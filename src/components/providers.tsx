"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      redirectTo="/"
      social={{ providers: ["google"] }}
    >
      <CopilotKit runtimeUrl="/api/copilotkit" agent="vic_agent">
        {children}
      </CopilotKit>
    </NeonAuthUIProvider>
  );
}
