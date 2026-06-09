import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Send, Zap, FileText } from "lucide-react";
import { AgentTopologyGraph } from "@/components/AgentTopologyGraph";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamAgentChat, type AgentOutput, type FlowStep } from "@/lib/api/agent-stream";
import { parseAgentOutputs } from "@/lib/parse-agent-outputs";
import { AGENT_EDGES, type AgentId, type NodeStatus } from "@/lib/agent-topology";
import { checkGatewayHealth, fetchAgentsStatus } from "@/lib/api/customer-agent";

const SAMPLE_QUESTIONS = [
  "If a company breaks a contract and avoids taxes, what are the legal consequences?",
  "Nếu công ty bị rò rỉ dữ liệu khách hàng, hậu quả pháp lý và thuế là gì?",
];

const IDLE_STATUS: Record<AgentId, NodeStatus> = {
  user: "idle",
  registry: "idle",
  customer: "idle",
  law: "idle",
  tax: "idle",
  compliance: "idle",
};

interface LogEntry {
  id: string;
  time: string;
  from: string;
  to: string;
  label: string;
  protocol: string;
}

function edgeIdForStep(step: FlowStep): string | undefined {
  const match = AGENT_EDGES.find((e) => e.from === step.from && e.to === step.to);
  return match?.id;
}

export function AgentFlowDemo() {
  const [input, setInput] = useState(SAMPLE_QUESTIONS[0]);
  const [running, setRunning] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [nodeStatus, setNodeStatus] = useState(IDLE_STATUS);
  const [activeEdges, setActiveEdges] = useState<string[]>([]);
  const [traceId, setTraceId] = useState<string>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [healthStatus, setHealthStatus] = useState<Partial<Record<AgentId, "online" | "offline">>>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [agentResults, setAgentResults] = useState<AgentOutput[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  const refreshHealth = useCallback(async () => {
    const [gw, agents] = await Promise.all([checkGatewayHealth(), fetchAgentsStatus()]);
    setOnline(gw);
    setHealthStatus({
      registry: agents.registry,
      customer: agents.customer,
      law: agents.law,
      tax: agents.tax,
      compliance: agents.compliance,
    });
    const offline = Object.entries(agents)
      .filter(([, s]) => s === "offline")
      .map(([id]) => id);
    if (offline.length > 0) {
      setWarning(`Offline: ${offline.join(", ")} — hệ thống sẽ trả về partial/degraded response`);
    } else {
      setWarning(null);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const t = setInterval(refreshHealth, 10000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentResults]);

  const resetVisual = useCallback(() => {
    setNodeStatus(IDLE_STATUS);
    setActiveEdges([]);
    setLogs([]);
    setAnswer("");
    setLatencyMs(null);
    setTraceId(undefined);
    setWarning(null);
    setAgentResults([]);
    setExpandedResult(null);
  }, []);

  const appendAgentResult = useCallback((output: AgentOutput, tid: string) => {
    setTraceId(tid);
    setAgentResults((prev) => {
      const key = `${output.agent_id}-${output.title}`;
      if (prev.some((r) => `${r.agent_id}-${r.title}` === key)) return prev;
      return [...prev, output];
    });
    setLogs((prev) => [
      ...prev,
      {
        id: `result-${output.agent_id}-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        from: output.agent_id,
        to: "artifact",
        label: `${output.title} (${output.chars} chars)`,
        protocol: output.status === "error" ? "ERROR" : "RESULT",
      },
    ]);
  }, []);

  const markAgentError = useCallback((agentId: string, message: string, tid: string) => {
    setTraceId(tid);
    const id = agentId as AgentId;
    if (id in IDLE_STATUS) {
      setNodeStatus((prev) => ({ ...prev, [id]: "error" }));
    }
    setLogs((prev) => [
      ...prev,
      {
        id: `err-${agentId}-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        from: agentId,
        to: "system",
        label: `⚠ ${message}`,
        protocol: "ERROR",
      },
    ]);
  }, []);

  const applyStep = useCallback((step: FlowStep, tid: string) => {
    setTraceId(tid);
    const edgeId = edgeIdForStep(step);
    if (edgeId) setActiveEdges([edgeId]);

    setNodeStatus((prev) => {
      const next = { ...prev };
      (Object.keys(next) as AgentId[]).forEach((k) => {
        if (next[k] === "active") next[k] = "done";
      });
      next[step.from as AgentId] = "active";
      next[step.to as AgentId] = "active";
      return next;
    });

    setLogs((prev) => [
      ...prev,
      {
        id: step.id,
        time: new Date().toLocaleTimeString(),
        from: step.from,
        to: step.to,
        label: step.label,
        protocol: step.protocol,
      },
    ]);
  }, []);

  const finishAll = useCallback((failedAgents: string[] = []) => {
    setNodeStatus((prev) => {
      const next = { ...prev };
      (Object.keys(next) as AgentId[]).forEach((k) => {
        if (failedAgents.includes(k)) next[k] = "error";
        else if (next[k] !== "error") next[k] = "done";
      });
      return next;
    });
    setActiveEdges([]);
    if (failedAgents.length > 0) {
      setWarning(
        `Degraded response — failed agents: ${failedAgents.join(", ")}. Các agent còn lại vẫn trả lời.`,
      );
    }
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || running) return;

    abortRef.current?.();
    resetVisual();
    setRunning(true);

    abortRef.current = streamAgentChat(text, {
      onStep: applyStep,
      onAgentError: markAgentError,
      onAgentResult: appendAgentResult,
      onDone: (result) => {
        finishAll(result.failed_agents ?? []);
        const outputs =
          result.agent_outputs?.length
            ? result.agent_outputs
            : parseAgentOutputs(result.answer);
        setTraceId(result.trace_id);
        setAgentResults(outputs);
        setLogs((prev) => [
          ...prev,
          ...outputs
            .filter((o) => !prev.some((l) => l.id === `result-${o.agent_id}-${o.title}`))
            .map((o) => ({
              id: `result-${o.agent_id}-${o.title}`,
              time: new Date().toLocaleTimeString(),
              from: o.agent_id,
              to: "artifact",
              label: `${o.title} (${o.chars} chars)`,
              protocol: o.status === "error" ? "ERROR" : "RESULT",
            })),
        ]);
        setAnswer(result.answer);
        setLatencyMs(result.latency_ms);
        setTraceId(result.trace_id);
        setRunning(false);
        refreshHealth();
      },
      onError: (msg, failedAgents) => {
        const failed = failedAgents ?? ["customer"];
        failed.forEach((id) => markAgentError(id, msg, traceId ?? "error"));
        setNodeStatus((prev) => {
          const next = { ...prev };
          failed.forEach((id) => {
            if (id in next) next[id as AgentId] = "error";
          });
          return next;
        });
        setAnswer(`## Error\n\n${msg}`);
        setWarning(msg);
        setRunning(false);
        refreshHealth();
      },
    });
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-4 p-4 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Stage 5 — A2A Agent Flow</h1>
            <p className="text-sm text-muted-foreground">
              Visualize multi-agent communication: Customer → Law → Tax ∥ Compliance
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : online === false ? "bg-red-500" : "bg-muted"}`}
            />
            <span className="text-muted-foreground">
              Gateway {online ? "online" : online === false ? "offline — run start_all.ps1" : "checking…"}
            </span>
          </div>
        </header>

        {warning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {warning}
          </div>
        )}

        <AgentTopologyGraph
          nodeStatus={nodeStatus}
          activeEdgeIds={activeEdges}
          traceId={traceId}
          healthStatus={healthStatus}
        />

        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
          <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              A2A Message Log
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
              {logs.length === 0 && (
                <p className="text-muted-foreground">Send a question to watch agents communicate…</p>
              )}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`border-b border-border/50 py-1 last:border-0 ${
                    log.protocol === "ERROR"
                      ? "text-red-400"
                      : log.protocol === "RESULT"
                        ? "text-emerald-400"
                        : ""
                  }`}
                >
                  <span className="text-muted-foreground">{log.time}</span>{" "}
                  <span className="text-primary">{log.from}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="text-primary">{log.to}</span>
                  <span className="text-muted-foreground"> [{log.protocol}] </span>
                  {log.label}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Agent Results (artifact)
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
              {agentResults.length === 0 && (
                <p className="text-muted-foreground">
                  Kết quả từng agent sẽ hiện ở đây sau khi pipeline hoàn tất…
                </p>
              )}
              {agentResults.map((r) => {
                const key = `${r.agent_id}-${r.title}`;
                const open = expandedResult === key;
                return (
                  <div
                    key={key}
                    className={`rounded-md border ${
                      r.status === "error" ? "border-red-500/40 bg-red-500/5" : "border-border bg-background/60"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                      onClick={() => setExpandedResult(open ? null : key)}
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-semibold capitalize text-primary">{r.agent_id}</span>
                      <span className="text-muted-foreground">— {r.title}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {r.chars} chars
                      </span>
                    </button>
                    {open && (
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-border/50 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground/90">
                        {r.content || r.preview}
                      </pre>
                    )}
                    {!open && r.preview && (
                      <p className="border-t border-border/30 px-2.5 py-1.5 text-[10px] text-muted-foreground line-clamp-2">
                        {r.preview}
                      </p>
                    )}
                  </div>
                );
              })}
              <div ref={resultsEndRef} />
            </div>
          </div>
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[360px]">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Sample questions</p>
          <div className="flex flex-col gap-1.5">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setInput(q)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
              >
                {q.slice(0, 72)}…
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="Legal question…"
            className="resize-none text-sm"
            disabled={running}
          />
          <Button onClick={handleSend} disabled={running || !input.trim()} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {running ? "Agents working…" : "Send & visualize"}
          </Button>

          {latencyMs != null && (
            <p className="text-center text-sm font-medium text-primary">
              Latency: {(latencyMs / 1000).toFixed(2)}s
            </p>
          )}

          {answer && (
            <div className="mt-1 max-h-[50vh] flex-1 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm leading-relaxed">
              {answer}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
