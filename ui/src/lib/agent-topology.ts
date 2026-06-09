export type AgentId =
  | "user"
  | "registry"
  | "customer"
  | "law"
  | "tax"
  | "compliance";

export type NodeStatus = "idle" | "active" | "done" | "error";

export interface AgentNode {
  id: AgentId;
  label: string;
  port?: number;
  role: string;
  x: number;
  y: number;
  compact?: boolean;
}

export interface AgentEdge {
  id: string;
  from: AgentId;
  to: AgentId;
  label: string;
  protocol: "HTTP" | "A2A";
  /** forward = luôn hiện mờ; return = chỉ hiện khi active */
  kind: "forward" | "return";
  /** orthogonal = đường gấp khúc sạch */
  route?: "straight" | "orthogonal";
}

/** Layout ngang: User → Customer → Law → fork Tax / Compliance */
export const AGENT_NODES: AgentNode[] = [
  { id: "user", label: "User", role: "Browser", x: 72, y: 175 },
  { id: "customer", label: "Customer", port: 10100, role: "Entry Point", x: 228, y: 175 },
  { id: "registry", label: "Registry", port: 10000, role: "Discovery", x: 228, y: 52, compact: true },
  { id: "law", label: "Law", port: 10101, role: "Orchestrator", x: 400, y: 175 },
  { id: "tax", label: "Tax", port: 10102, role: "Specialist", x: 620, y: 72 },
  { id: "compliance", label: "Compliance", port: 10103, role: "Specialist", x: 620, y: 278 },
];

export const AGENT_EDGES: AgentEdge[] = [
  { id: "e-user-customer", from: "user", to: "customer", label: "chat", protocol: "HTTP", kind: "forward", route: "straight" },
  { id: "e-customer-registry", from: "customer", to: "registry", label: "discover", protocol: "HTTP", kind: "forward", route: "straight" },
  { id: "e-customer-law", from: "customer", to: "law", label: "delegate", protocol: "A2A", kind: "forward", route: "straight" },
  { id: "e-law-tax", from: "law", to: "tax", label: "dispatch", protocol: "A2A", kind: "forward", route: "orthogonal" },
  { id: "e-law-compliance", from: "law", to: "compliance", label: "dispatch", protocol: "A2A", kind: "forward", route: "orthogonal" },
  { id: "e-tax-law", from: "tax", to: "law", label: "artifact", protocol: "A2A", kind: "return", route: "orthogonal" },
  { id: "e-compliance-law", from: "compliance", to: "law", label: "artifact", protocol: "A2A", kind: "return", route: "orthogonal" },
  { id: "e-law-customer", from: "law", to: "customer", label: "response", protocol: "A2A", kind: "return", route: "straight" },
  { id: "e-customer-user", from: "customer", to: "user", label: "answer", protocol: "HTTP", kind: "return", route: "straight" },
];

export function nodeById(id: AgentId): AgentNode {
  const n = AGENT_NODES.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown agent: ${id}`);
  return n;
}
