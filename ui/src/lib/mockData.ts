import type { LucideIcon } from "lucide-react";
import { Users, Scale, ShieldCheck, Calculator } from "lucide-react";

export type AgentStatus = "active" | "idle" | "offline";

export interface AgentTool {
  name: string;
  description: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  icon: LucideIcon;
  accent: string;
  tools: AgentTool[];
  metrics: {
    requests: number;
    avgLatencyMs: number;
    successRate: number;
  };
}

export const agents: Agent[] = [
  {
    id: "customer_agent",
    name: "Customer Agent",
    role: "Orchestrator & user-facing intake",
    status: "active",
    icon: Users,
    accent: "from-emerald-400/30 to-teal-500/10",
    tools: [
      { name: "intent_classifier", description: "Classifies incoming user intent" },
      { name: "delegate_to_agent", description: "Routes to specialist agents" },
      { name: "summarize_response", description: "Final answer composition" },
    ],
    metrics: { requests: 1284, avgLatencyMs: 312, successRate: 98.4 },
  },
  {
    id: "law_agent",
    name: "Law Agent",
    role: "Legal reasoning & contract analysis",
    status: "active",
    icon: Scale,
    accent: "from-violet-400/30 to-fuchsia-500/10",
    tools: [
      { name: "case_law_search", description: "Searches legal precedents" },
      { name: "contract_parser", description: "Extracts clauses from contracts" },
      { name: "jurisdiction_lookup", description: "Resolves applicable jurisdiction" },
    ],
    metrics: { requests: 642, avgLatencyMs: 845, successRate: 96.1 },
  },
  {
    id: "compliance_agent",
    name: "Compliance Agent",
    role: "Policy & regulatory review",
    status: "idle",
    icon: ShieldCheck,
    accent: "from-sky-400/30 to-blue-500/10",
    tools: [
      { name: "policy_check", description: "Validates against company policies" },
      { name: "gdpr_scan", description: "Detects GDPR-sensitive data" },
      { name: "audit_log", description: "Writes immutable audit entries" },
    ],
    metrics: { requests: 431, avgLatencyMs: 528, successRate: 99.0 },
  },
  {
    id: "tax_agent",
    name: "Tax Agent",
    role: "Tax calculation & regulation lookup",
    status: "active",
    icon: Calculator,
    accent: "from-amber-400/30 to-orange-500/10",
    tools: [
      { name: "database_query", description: "Queries tax rule database" },
      { name: "rate_calculator", description: "Computes effective tax rates" },
      { name: "treaty_lookup", description: "Cross-border treaty resolver" },
    ],
    metrics: { requests: 387, avgLatencyMs: 612, successRate: 97.8 },
  },
];

export interface PipelineStage {
  id: string;
  label: string;
  description: string;
  status: "complete" | "active" | "pending";
}

export const pipelineStages: PipelineStage[] = [
  { id: "stage_1_direct_llm", label: "Stage 1 — Direct LLM", description: "Raw LLM calls, no tools", status: "complete" },
  { id: "stage_2_rag_tools", label: "Stage 2 — RAG + Tools", description: "Retrieval and tool execution", status: "complete" },
  { id: "stage_3_single_agent", label: "Stage 3 — Single Agent", description: "ReAct agent with planning", status: "complete" },
  { id: "stage_4_multi_agent", label: "Stage 4 — Multi-Agent", description: "Coordinated specialist agents", status: "active" },
];

export type TraceStepKind = "receive" | "delegate" | "tool" | "review" | "respond";

export interface TraceStep {
  id: string;
  agentId: string;
  agentName: string;
  kind: TraceStepKind;
  title: string;
  detail: string;
  durationMs: number;
}

export type ChatRole = "user" | "assistant";

export interface ToolCall {
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  trace?: TraceStep[];
  toolCalls?: ToolCall[];
  isClarification?: boolean;
  createdAt: number;
}

export const sampleConversation: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Check if this sales contract complies with EU tax laws and GDPR.",
    createdAt: Date.now() - 60_000,
  },
  {
    id: "m2",
    role: "assistant",
    createdAt: Date.now() - 30_000,
    content:
      "**Summary:** The contract is **mostly compliant** but two issues require attention:\n\n1. **VAT clause** missing reverse-charge wording for cross-border B2B sales.\n2. **GDPR Article 28** processor terms are incomplete — add sub-processor list and breach notification SLA.\n\nLegal precedent and tax treaty checks all passed.",
    trace: [
      { id: "t1", agentId: "customer_agent", agentName: "Customer Agent", kind: "receive", title: "Received prompt", detail: "Classified intent: contract_review (confidence 0.94)", durationMs: 84 },
      { id: "t2", agentId: "customer_agent", agentName: "Customer Agent", kind: "delegate", title: "Dispatching specialists", detail: "Invoking Law Agent and Tax Agent in parallel", durationMs: 12 },
      { id: "t3", agentId: "law_agent", agentName: "Law Agent", kind: "tool", title: "contract_parser", detail: "Extracted 14 clauses, flagged 2 GDPR gaps", durationMs: 612 },
      { id: "t4", agentId: "tax_agent", agentName: "Tax Agent", kind: "tool", title: "database_query", detail: "Queried EU VAT rule set, found missing reverse-charge clause", durationMs: 488 },
      { id: "t5", agentId: "compliance_agent", agentName: "Compliance Agent", kind: "review", title: "Reviewing combined output", detail: "Cross-checked findings against internal policy P-22", durationMs: 274 },
      { id: "t6", agentId: "customer_agent", agentName: "Customer Agent", kind: "respond", title: "Composing final answer", detail: "Merged specialist findings into user-facing summary", durationMs: 156 },
    ],
    toolCalls: [
      { agent: "Law Agent", tool: "contract_parser", input: { document_id: "ct_881", lang: "en" }, output: "14 clauses extracted; 2 flagged" },
      { agent: "Tax Agent", tool: "database_query", input: { region: "EU", type: "VAT", scope: "B2B cross-border" }, output: "Missing reverse-charge clause" },
      { agent: "Compliance Agent", tool: "gdpr_scan", input: { document_id: "ct_881" }, output: "Article 28 partially satisfied" },
    ],
  },
];

export interface McpTool {
  id: string;
  name: string;
  kind: "tool" | "resource" | "prompt";
  ownerAgent: string;
  description: string;
  schema: Record<string, unknown>;
  sampleInput: Record<string, unknown>;
}

export const mcpRegistry: McpTool[] = [
  {
    id: "database_query",
    name: "database_query",
    kind: "tool",
    ownerAgent: "tax_agent",
    description: "Executes a parameterized query against the tax-rules database.",
    schema: { region: "string", type: "string", scope: "string" },
    sampleInput: { region: "EU", type: "VAT", scope: "B2B cross-border" },
  },
  {
    id: "contract_parser",
    name: "contract_parser",
    kind: "tool",
    ownerAgent: "law_agent",
    description: "Parses a contract document and extracts structured clauses.",
    schema: { document_id: "string", lang: "string" },
    sampleInput: { document_id: "ct_881", lang: "en" },
  },
  {
    id: "gdpr_scan",
    name: "gdpr_scan",
    kind: "tool",
    ownerAgent: "compliance_agent",
    description: "Scans a document for GDPR-sensitive data and Article 28 gaps.",
    schema: { document_id: "string" },
    sampleInput: { document_id: "ct_881" },
  },
  {
    id: "case_law_search",
    name: "case_law_search",
    kind: "tool",
    ownerAgent: "law_agent",
    description: "Searches case-law corpus for relevant precedents.",
    schema: { query: "string", jurisdiction: "string", limit: "number" },
    sampleInput: { query: "reverse charge VAT B2B", jurisdiction: "EU", limit: 5 },
  },
  {
    id: "policy_corpus",
    name: "policy_corpus",
    kind: "resource",
    ownerAgent: "compliance_agent",
    description: "Internal company policy documents (read-only resource).",
    schema: { policy_id: "string" },
    sampleInput: { policy_id: "P-22" },
  },
  {
    id: "contract_review_prompt",
    name: "contract_review_prompt",
    kind: "prompt",
    ownerAgent: "customer_agent",
    description: "Prompt template for orchestrating contract review across agents.",
    schema: { document_id: "string", focus: "string[]" },
    sampleInput: { document_id: "ct_881", focus: ["tax", "gdpr"] },
  },
];

export function runMockTool(toolId: string, input: Record<string, unknown>) {
  return {
    tool: toolId,
    received_at: new Date().toISOString(),
    input,
    status: "ok",
    duration_ms: Math.round(80 + Math.random() * 600),
    output: {
      summary: `Mock execution of ${toolId} completed.`,
      sample_data: [
        { id: 1, label: "result A", score: 0.92 },
        { id: 2, label: "result B", score: 0.81 },
      ],
    },
  };
}

export type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

const sampleLogLines: Array<Omit<LogEntry, "id" | "timestamp">> = [
  { level: "INFO", source: "orchestrator", message: "Customer Agent received new prompt" },
  { level: "DEBUG", source: "router", message: "Intent classified as contract_review (0.94)" },
  { level: "INFO", source: "law_agent", message: "Invoking tool contract_parser" },
  { level: "DEBUG", source: "mcp", message: "Tool contract_parser returned 14 clauses" },
  { level: "INFO", source: "tax_agent", message: "Invoking tool database_query" },
  { level: "WARN", source: "tax_agent", message: "VAT reverse-charge clause missing" },
  { level: "INFO", source: "compliance_agent", message: "Running gdpr_scan on document ct_881" },
  { level: "WARN", source: "compliance_agent", message: "Article 28 processor terms incomplete" },
  { level: "DEBUG", source: "orchestrator", message: "Merging specialist outputs" },
  { level: "INFO", source: "customer_agent", message: "Streaming final response to client" },
  { level: "ERROR", source: "mcp", message: "Tool treaty_lookup timed out after 3000ms (retrying)" },
  { level: "INFO", source: "mcp", message: "Retry succeeded for treaty_lookup" },
];

let logCursor = 0;
export function generateLogEntry(): LogEntry {
  const sample = sampleLogLines[logCursor % sampleLogLines.length];
  logCursor += 1;
  return {
    id: `${Date.now()}-${logCursor}`,
    timestamp: new Date().toISOString(),
    ...sample,
  };
}

export function seedLogs(count = 12): LogEntry[] {
  return Array.from({ length: count }, () => generateLogEntry());
}

export function streamMockAssistantResponse(
  prompt: string,
  onChunk: (chunk: string) => void,
  onTrace: (step: TraceStep) => void,
  onDone: (toolCalls: ToolCall[]) => void,
): () => void {
  const trace: TraceStep[] = [
    { id: "s1", agentId: "customer_agent", agentName: "Customer Agent", kind: "receive", title: "Received prompt", detail: `Classified intent for: "${prompt.slice(0, 48)}…"`, durationMs: 92 },
    { id: "s2", agentId: "customer_agent", agentName: "Customer Agent", kind: "delegate", title: "Dispatching specialists", detail: "Invoking Law Agent and Tax Agent in parallel", durationMs: 14 },
    { id: "s3", agentId: "law_agent", agentName: "Law Agent", kind: "tool", title: "contract_parser", detail: "Extracting clauses from referenced document", durationMs: 540 },
    { id: "s4", agentId: "tax_agent", agentName: "Tax Agent", kind: "tool", title: "database_query", detail: "Looking up applicable tax rules", durationMs: 470 },
    { id: "s5", agentId: "compliance_agent", agentName: "Compliance Agent", kind: "review", title: "Final review", detail: "Cross-checked against internal policy", durationMs: 230 },
    { id: "s6", agentId: "customer_agent", agentName: "Customer Agent", kind: "respond", title: "Composing answer", detail: "Streaming final response", durationMs: 140 },
  ];

  const chunks = [
    "Analyzing your request across the multi-agent pipeline…\n\n",
    "**Findings**\n\n",
    "- The Law Agent reviewed the referenced clauses and surfaced **2 potential gaps**.\n",
    "- The Tax Agent confirmed applicable rates and noted **one missing VAT clause**.\n",
    "- The Compliance Agent cross-checked against internal policy P-22 — **no blocking issues**.\n\n",
    "**Recommendation:** Patch the two flagged clauses and re-run the review.",
  ];

  const toolCalls: ToolCall[] = [
    { agent: "Law Agent", tool: "contract_parser", input: { prompt }, output: "2 gaps detected" },
    { agent: "Tax Agent", tool: "database_query", input: { prompt }, output: "Missing VAT clause" },
    { agent: "Compliance Agent", tool: "gdpr_scan", input: { prompt }, output: "OK" },
  ];

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  trace.forEach((step, i) => {
    timeouts.push(setTimeout(() => onTrace(step), 250 * (i + 1)));
  });
  chunks.forEach((chunk, i) => {
    timeouts.push(setTimeout(() => onChunk(chunk), 1800 + i * 380));
  });
  timeouts.push(setTimeout(() => onDone(toolCalls), 1800 + chunks.length * 380 + 200));

  return () => timeouts.forEach(clearTimeout);
}