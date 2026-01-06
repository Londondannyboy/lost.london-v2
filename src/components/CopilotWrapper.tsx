'use client'

import { CopilotKit } from "@copilotkit/react-core"

interface CopilotWrapperProps {
  children: React.ReactNode
}

export function CopilotWrapper({ children }: CopilotWrapperProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="vic_agent">
      {children}
    </CopilotKit>
  )
}
