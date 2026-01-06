import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000/agui";

// Empty adapter since we're using our own Pydantic AI agent
const serviceAdapter = new ExperimentalEmptyAdapter();

// Create CopilotRuntime with our VIC agent
const runtime = new CopilotRuntime({
  agents: {
    vic_agent: new HttpAgent({ url: AGENT_URL }),
  },
});

// Next.js API route handler
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
