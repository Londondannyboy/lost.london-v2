"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { ReactNode } from "react";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000/agui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="vic_agent">
      {children}
    </CopilotKit>
  );
}
