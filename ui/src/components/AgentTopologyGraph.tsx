import { useMemo } from "react";
import {
  AGENT_EDGES,
  AGENT_NODES,
  type AgentEdge,
  type AgentNode,
  type AgentId,
  type NodeStatus,
  nodeById,
} from "@/lib/agent-topology";

interface Props {
  nodeStatus: Record<AgentId, NodeStatus>;
  activeEdgeIds: string[];
  traceId?: string;
  /** Ping trước khi gửi — agent shutdown hiện đỏ */
  healthStatus?: Partial<Record<AgentId, "online" | "offline">>;
}

const W = 96;
const H = 64;
const W_SM = 88;
const H_SM = 48;

function box(node: AgentNode) {
  const w = node.compact ? W_SM : W;
  const h = node.compact ? H_SM : H;
  return { w, h, hw: w / 2, hh: h / 2 };
}

/** Đường thẳng hoặc gấp khúc (orthogonal) — không dùng curve lớn */
function buildPath(from: AgentNode, to: AgentNode, edge: AgentEdge): string {
  const fb = box(from);
  const tb = box(to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (edge.route === "orthogonal" && from.id === "law") {
    const xMid = from.x + fb.hw + 28;
    const y1 = from.y;
    const x2 = to.x - tb.hw;
    const y2 = to.y;
    return `M ${from.x + fb.hw} ${y1} L ${xMid} ${y1} L ${xMid} ${y2} L ${x2} ${y2}`;
  }

  if (edge.route === "orthogonal" && to.id === "law") {
    const xMid = to.x - tb.hw - 28;
    return `M ${from.x - fb.hw} ${from.y} L ${xMid} ${from.y} L ${xMid} ${to.y} L ${to.x - tb.hw} ${to.y}`;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    const x1 = dx >= 0 ? from.x + fb.hw : from.x - fb.hw;
    const x2 = dx >= 0 ? to.x - tb.hw : to.x + tb.hw;
    return `M ${x1} ${from.y} L ${x2} ${to.y}`;
  }

  const y1 = dy >= 0 ? from.y + fb.hh : from.y - fb.hh;
  const y2 = dy >= 0 ? to.y - tb.hh : to.y + tb.hh;
  return `M ${from.x} ${y1} L ${to.x} ${y2}`;
}

const NODE_BORDER: Record<NodeStatus, string> = {
  idle: "#475569",
  active: "#38bdf8",
  done: "#4ade80",
  error: "#f87171",
};

const NODE_BG: Record<NodeStatus, string> = {
  idle: "#1e293b",
  active: "#0c4a6e",
  done: "#14532d",
  error: "#450a0a",
};

export function AgentTopologyGraph({ nodeStatus, activeEdgeIds, traceId, healthStatus }: Props) {
  const activeSet = useMemo(() => new Set(activeEdgeIds), [activeEdgeIds]);

  const visibleEdges = AGENT_EDGES.filter(
    (e) => e.kind === "forward" || activeSet.has(e.id),
  );

  return (
    <div className="relative min-h-[360px] w-full rounded-xl border border-slate-800 bg-slate-950 p-4">
      <svg viewBox="0 0 700 330" className="h-full w-full" aria-label="Agent topology">
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* edges */}
        {visibleEdges.map((edge) => {
          const from = nodeById(edge.from);
          const to = nodeById(edge.to);
          const active = activeSet.has(edge.id);
          const d = buildPath(from, to, edge);
          const isReturn = edge.kind === "return";

          return (
            <g key={edge.id}>
              <path
                d={d}
                fill="none"
                stroke={active ? "#38bdf8" : "#334155"}
                strokeWidth={active ? 2 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isReturn && !active ? "4 4" : active ? "6 4" : undefined}
                markerEnd={active ? "url(#arr)" : undefined}
                opacity={active ? 1 : 0.7}
              />
              {active && (
                <circle r="4" fill="#38bdf8">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {AGENT_NODES.map((node) => {
          let status = nodeStatus[node.id] ?? "idle";
          if (status === "idle" && healthStatus?.[node.id] === "offline") {
            status = "error";
          }
          const { w, h, hw, hh } = box(node);

          return (
            <g key={node.id} transform={`translate(${node.x - hw}, ${node.y - hh})`}>
              <rect
                width={w}
                height={h}
                rx={8}
                fill={NODE_BG[status]}
                stroke={NODE_BORDER[status]}
                strokeWidth={status === "active" ? 2 : 1}
              />
              <text x={hw} y={node.compact ? 20 : 22} textAnchor="middle" fill="#f8fafc" fontSize={node.compact ? 10 : 11} fontWeight={600}>
                {node.label}
              </text>
              {node.port && (
                <text x={hw} y={node.compact ? 36 : 40} textAnchor="middle" fill="#7dd3fc" fontSize={9} fontFamily="monospace">
                  :{node.port}
                </text>
              )}
              {!node.compact && (
                <text x={hw} y={54} textAnchor="middle" fill="#64748b" fontSize={8}>
                  {node.role}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* legend — gọn, không label trên từng đường */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-slate-600" /> HTTP
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-slate-500" /> A2A return
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> đang chạy
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-400" /> offline
        </span>
        {traceId && (
          <span className="font-mono text-slate-600">trace:{traceId.slice(0, 8)}</span>
        )}
      </div>
    </div>
  );
}
