import { Check, Loader2, Circle } from "lucide-react";
import { pipelineStages } from "@/lib/mockData";
import { Card } from "@/components/ui/card";

export function PipelineStages() {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline evolution
        </h2>
        <span className="text-xs text-muted-foreground">stages/</span>
      </div>
      <ol className="relative grid gap-4 sm:grid-cols-4">
        {pipelineStages.map((stage, i) => {
          const isActive = stage.status === "active";
          const isComplete = stage.status === "complete";
          return (
            <li key={stage.id} className="relative">
              {i < pipelineStages.length - 1 && (
                <div className="absolute left-5 top-5 hidden h-0.5 w-full -translate-y-1/2 bg-border sm:block" />
              )}
              <div className="relative flex items-start gap-3 sm:flex-col sm:items-start">
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    isActive
                      ? "border-primary bg-primary/15 text-primary"
                      : isComplete
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">{stage.description}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}