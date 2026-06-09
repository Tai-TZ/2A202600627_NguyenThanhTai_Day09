import type { AgentOutput } from "@/lib/api/agent-stream";

const SECTIONS: { agent_id: string; keywords: string[] }[] = [
  { agent_id: "law", keywords: ["legal analysis", "phân tích pháp lý"] },
  { agent_id: "tax", keywords: ["tax analysis", "phân tích thuế", "tax implications"] },
  {
    agent_id: "compliance",
    keywords: ["regulatory compliance", "compliance analysis", "phân tích tuân thủ"],
  },
];

export function parseAgentOutputs(answer: string): AgentOutput[] {
  if (!answer.trim()) return [];

  const results: AgentOutput[] = [];
  const parts = answer.split(/(?=^#{1,2}\s+)/m).filter((p) => p.trim());

  if (parts.length > 1 || /^#{1,2}\s+/m.test(answer)) {
    for (const part of parts) {
      const lines = part.trim().split("\n");
      const header = lines[0]?.replace(/^#+\s*/, "").trim() ?? "Section";
      const body = lines.slice(1).join("\n").trim();
      const agent_id = matchAgent(header, body);
      const status = isUnavailable(agent_id, body) ? "error" : "ok";
      results.push(makeEntry(agent_id, header, body, status));
    }
  } else {
    for (const { agent_id, keywords } of SECTIONS) {
      const lower = answer.toLowerCase();
      const kw = keywords.find((k) => lower.includes(k));
      if (kw) {
        const idx = lower.indexOf(kw);
        const chunk = answer.slice(idx, idx + 1500).trim();
        results.push(
          makeEntry(agent_id, kw, chunk, isUnavailable(agent_id, chunk) ? "error" : "ok"),
        );
      }
    }
    if (results.length === 0) {
      results.push(makeEntry("law", "Full Response", answer.trim(), "ok"));
    }
  }

  results.push(
    makeEntry("customer", "Delivered to User", `Packaged ${answer.length} chars.`, "ok"),
  );
  return results;
}

function matchAgent(header: string, body: string): string {
  const h = header.toLowerCase();
  for (const { agent_id, keywords } of SECTIONS) {
    if (keywords.some((k) => h.includes(k))) return agent_id;
  }
  if (body.toLowerCase().includes("tax analysis unavailable")) return "tax";
  if (body.toLowerCase().includes("compliance analysis unavailable")) return "compliance";
  return "law";
}

function isUnavailable(agent_id: string, body: string): boolean {
  const b = body.toLowerCase();
  if (agent_id === "tax" && b.includes("tax analysis unavailable")) return true;
  if (agent_id === "compliance" && b.includes("compliance analysis unavailable")) return true;
  if (agent_id === "law" && b.includes("law agent unavailable")) return true;
  return false;
}

function makeEntry(
  agent_id: string,
  title: string,
  content: string,
  status: "ok" | "error",
): AgentOutput {
  return {
    agent_id,
    title,
    content,
    preview: content.slice(0, 500) + (content.length > 500 ? "…" : ""),
    chars: content.length,
    status,
  };
}
