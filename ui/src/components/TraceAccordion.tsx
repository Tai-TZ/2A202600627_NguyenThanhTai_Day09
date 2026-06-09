import { ArrowRight, Wrench, Users, ShieldCheck, MessageSquare } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { TraceStep } from "@/lib/mockData";

const kindIcon = {
  receive: Users,
  delegate: ArrowRight,
  tool: Wrench,
  review: ShieldCheck,
  respond: MessageSquare,
} as const;

export function TraceAccordion({ steps, defaultOpen = false }: { steps: TraceStep[]; defaultOpen?: boolean }) {
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? "trace" : undefined}>
      <AccordionItem value="trace" className="rounded-lg border border-border/60 bg-card/40 px-3">
        <AccordionTrigger className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:no-underline">
          Thought process · {steps.length} steps
        </AccordionTrigger>
        <AccordionContent>
          <ol className="relative ml-2 space-y-3 border-l border-border/60 pl-4">
            {steps.map((s) => {
              const Icon = kindIcon[s.kind];
              return (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-primary ring-2 ring-background">
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold text-foreground">{s.agentName}</span>
                    <span className="font-mono text-xs text-primary">{s.title}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{s.durationMs}ms</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </li>
              );
            })}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}