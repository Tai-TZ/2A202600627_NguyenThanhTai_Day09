import { useEffect, useRef, useState } from "react";
import { Trash2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateLogEntry, seedLogs, type LogEntry, type LogLevel } from "@/lib/mockData";

const levelStyles: Record<LogLevel, string> = {
  INFO: "text-sky-400",
  DEBUG: "text-muted-foreground",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
};

const LEVELS: LogLevel[] = ["INFO", "DEBUG", "WARN", "ERROR"];

export function TerminalEmulator() {
  const [logs, setLogs] = useState<LogEntry[]>(() => seedLogs());
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState<Set<LogLevel>>(new Set(LEVELS));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setLogs((l) => [...l, generateLogEntry()].slice(-300));
    }, 1400);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (autoScroll) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [logs, autoScroll]);

  const filtered = logs.filter((l) => filters.has(l.level));

  function toggleLevel(level: LogLevel) {
    setFilters((f) => {
      const n = new Set(f);
      if (n.has(level)) n.delete(level);
      else n.add(level);
      return n;
    });
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLogs([])}>
          <Trash2 className="mr-1 h-3 w-3" /> Clear
        </Button>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          Auto-scroll
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          {LEVELS.map((lvl) => {
            const active = filters.has(lvl);
            return (
              <Badge
                key={lvl}
                onClick={() => toggleLevel(lvl)}
                variant="outline"
                className={`cursor-pointer select-none transition-opacity ${active ? "opacity-100" : "opacity-40"} ${levelStyles[lvl]} border-current/40`}
              >
                {lvl}
              </Badge>
            );
          })}
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {filtered.map((l) => (
          <div key={l.id} className="flex gap-3">
            <span className="text-muted-foreground/60">{l.timestamp.slice(11, 19)}</span>
            <span className={`w-12 font-semibold ${levelStyles[l.level]}`}>{l.level}</span>
            <span className="w-32 truncate text-accent">{l.source}</span>
            <span className="text-foreground/90">{l.message}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">No logs match current filters.</div>
        )}
      </div>
    </div>
  );
}