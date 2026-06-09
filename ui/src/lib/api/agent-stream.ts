export interface FlowStep {
  id: string;
  from: string;
  to: string;
  label: string;
  protocol: string;
  detail?: string;
  parallel?: boolean;
}

export interface AgentOutput {
  agent_id: string;
  title: string;
  content: string;
  preview: string;
  chars: number;
  status: "ok" | "error";
}

export interface StreamDone {
  answer: string;
  latency_ms: number;
  trace_id: string;
  agent_name: string;
  failed_agents?: string[];
  degraded?: boolean;
  agent_outputs?: AgentOutput[];
}

export interface StreamCallbacks {
  onStep: (step: FlowStep, traceId: string) => void;
  onAgentError: (agentId: string, message: string, traceId: string) => void;
  onAgentResult: (output: AgentOutput, traceId: string) => void;
  onDone: (result: StreamDone) => void;
  onError: (message: string, failedAgents?: string[]) => void;
}

export function streamAgentChat(message: string, callbacks: StreamCallbacks): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        callbacks.onError(await res.text().catch(() => `HTTP ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6)) as {
            type: string;
            step?: FlowStep;
            trace_id?: string;
            answer?: string;
            latency_ms?: number;
            agent_name?: string;
            message?: string;
            agent_id?: string;
            failed_agents?: string[];
            degraded?: boolean;
            title?: string;
            content?: string;
            preview?: string;
            chars?: number;
            status?: string;
            agent_outputs?: AgentOutput[];
          };

          if (payload.type === "step" && payload.step && payload.trace_id) {
            callbacks.onStep(payload.step, payload.trace_id);
          } else if (payload.type === "agent_error" && payload.agent_id && payload.trace_id) {
            callbacks.onAgentError(
              payload.agent_id,
              payload.message ?? "Agent offline",
              payload.trace_id,
            );
          } else if (
            payload.type === "agent_result" &&
            payload.agent_id &&
            payload.trace_id &&
            payload.title
          ) {
            callbacks.onAgentResult(
              {
                agent_id: payload.agent_id,
                title: payload.title,
                content: payload.content ?? "",
                preview: payload.preview ?? "",
                chars: payload.chars ?? 0,
                status: payload.status === "error" ? "error" : "ok",
              },
              payload.trace_id,
            );
          } else if (payload.type === "done" && payload.answer != null) {
            callbacks.onDone({
              answer: payload.answer,
              latency_ms: payload.latency_ms ?? 0,
              trace_id: payload.trace_id ?? "",
              agent_name: payload.agent_name ?? "Customer Agent",
              failed_agents: payload.failed_agents,
              degraded: payload.degraded,
              agent_outputs: payload.agent_outputs,
            });
          } else if (payload.type === "error") {
            callbacks.onError(payload.message ?? "Stream error", payload.failed_agents);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError((err as Error).message);
      }
    }
  })();

  return () => controller.abort();
}
