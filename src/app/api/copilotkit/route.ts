import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

// Empty adapter since we're using our own Pydantic AI agent
const serviceAdapter = new ExperimentalEmptyAdapter();

// Next.js API route handler - create runtime at request time to get env vars
export const POST = async (req: NextRequest) => {
  // Get AGENT_URL at runtime, not build time
  const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000/agui";
  console.log("[CopilotKit] Using AGENT_URL:", AGENT_URL);

  // Create CopilotRuntime with our VIC agent
  const runtime = new CopilotRuntime({
    agents: {
      vic_agent: new HttpAgent({ url: AGENT_URL }),
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
