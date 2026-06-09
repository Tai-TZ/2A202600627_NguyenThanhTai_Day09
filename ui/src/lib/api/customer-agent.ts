export interface ChatResult {
  answer: string;
  latencyMs: number;
  agentName: string;
}

export interface AgentCardInfo {
  name: string;
  description: string;
  version: string;
}

export async function fetchAgentCard(): Promise<AgentCardInfo> {
  const res = await fetch("/api/agent-card");
  if (!res.ok) throw new Error("Customer Agent is offline. Start agents with start_all.ps1");
  const data = await res.json();
  return { name: data.name, description: data.description, version: data.version };
}

export async function sendChatMessage(message: string): Promise<ChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return {
    answer: data.answer,
    latencyMs: data.latency_ms,
    agentName: data.agent_name,
  };
}

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

export type AgentHealth = "online" | "offline" | "unknown";

export async function fetchAgentsStatus(): Promise<Record<string, AgentHealth>> {
  try {
    const res = await fetch("/api/agents/status");
    if (!res.ok) return {};
    const data = (await res.json()) as { agents: Record<string, string> };
    const out: Record<string, AgentHealth> = {};
    for (const [id, status] of Object.entries(data.agents ?? {})) {
      out[id] = status === "online" ? "online" : "offline";
    }
    return out;
  } catch {
    return {};
  }
}
