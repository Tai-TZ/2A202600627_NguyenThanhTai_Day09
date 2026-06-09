import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Agent } from "@/lib/mockData";

const statusStyles: Record<Agent["status"], string> = {
  active: "bg-primary/15 text-primary border-primary/30",
  idle: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  offline: "bg-muted text-muted-foreground border-border",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const Icon = agent.icon;
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card transition-colors hover:border-primary/40">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${agent.accent} opacity-60`} />
      <CardHeader className="relative flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 text-foreground ring-1 ring-border">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">{agent.name}</h3>
            <Badge variant="outline" className={statusStyles[agent.status]}>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {agent.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{agent.role}</p>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Capabilities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t) => (
              <span
                key={t.name}
                title={t.description}
                className="rounded-md border border-border/70 bg-background/40 px-2 py-0.5 text-xs font-mono text-foreground/90"
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
          <Metric label="Requests" value={agent.metrics.requests.toLocaleString()} />
          <Metric label="Avg Latency" value={`${agent.metrics.avgLatencyMs}ms`} />
          <Metric label="Success" value={`${agent.metrics.successRate}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}