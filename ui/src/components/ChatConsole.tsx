import { useEffect, useRef, useState } from "react";
import { Send, Wrench, User, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TraceAccordion } from "@/components/TraceAccordion";
import { sendChatMessage } from "@/lib/api/customer-agent";
import { type ChatMessage, type TraceStep } from "@/lib/mockData";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào! Tôi là **Customer Agent** — điểm vào hệ thống multi-agent pháp lý. " +
    "Hãy đặt câu hỏi (tiếng Anh hoặc Việt) và tôi sẽ chuyển tới Law, Tax và Compliance agents.",
  createdAt: Date.now(),
};

export function ChatConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, createdAt: Date.now() };
    const asstId = `a-${Date.now()}`;
    const asstMsg: ChatMessage = {
      id: asstId,
      role: "assistant",
      content: "",
      trace: [],
      toolCalls: [],
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg, asstMsg]);
    setInput("");
    setStreaming(true);

    const traceStart: TraceStep = {
      id: "t1",
      agentId: "customer_agent",
      agentName: "Customer Agent",
      kind: "receive",
      title: "Sending via A2A",
      detail: "Đang gửi câu hỏi qua A2A protocol…",
      durationMs: 0,
    };
    setMessages((m) =>
      m.map((x) => (x.id === asstId ? { ...x, trace: [traceStart] } : x)),
    );

    sendChatMessage(text)
      .then((result) => {
        const traceDone: TraceStep[] = [
          {
            id: "t1",
            agentId: "customer_agent",
            agentName: "Customer Agent",
            kind: "receive",
            title: "Received prompt",
            detail: "Routed to Law Agent",
            durationMs: 50,
          },
          {
            id: "t2",
            agentId: "law_agent",
            agentName: "Law Agent",
            kind: "delegate",
            title: "Parallel dispatch",
            detail: "Tax + Compliance agents invoked",
            durationMs: Math.round(result.latencyMs * 0.4),
          },
          {
            id: "t3",
            agentId: "customer_agent",
            agentName: result.agentName,
            kind: "respond",
            title: "Final answer",
            detail: `Completed in ${(result.latencyMs / 1000).toFixed(1)}s`,
            durationMs: Math.round(result.latencyMs),
          },
        ];
        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? { ...x, content: result.answer, trace: traceDone, toolCalls: [] }
              : x,
          ),
        );
      })
      .catch((err: Error) => {
        setMessages((m) =>
          m.map((x) =>
            x.id === asstId
              ? {
                  ...x,
                  content: `**Lỗi:** ${err.message}\n\nĐảm bảo đã chạy \`start_all.ps1\` và gateway (port 10200).`,
                  trace: [{
                    id: "err",
                    agentId: "system",
                    agentName: "System",
                    kind: "review",
                    title: "Error",
                    detail: err.message,
                    durationMs: 0,
                  }],
                }
              : x,
          ),
        );
      })
      .finally(() => setStreaming(false));
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div ref={scrollerRef} className="flex-1 space-y-6 overflow-y-auto rounded-lg border border-border/60 bg-card/30 p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} streaming={streaming && m.id === messages[messages.length - 1]?.id} />
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask the multi-agent system… (e.g. Check this contract against EU tax laws)"
          className="min-h-12 resize-none border-0 bg-transparent focus-visible:ring-0"
        />
        <Button onClick={handleSend} disabled={!input.trim() || streaming} size="icon" className="shrink-0">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-border ${
          isUser ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex max-w-[85%] flex-1 flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {message.role === "assistant" && message.trace && message.trace.length > 0 && (
          <div className="w-full">
            <TraceAccordion steps={message.trace} />
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex w-full flex-wrap gap-1.5">
            {message.toolCalls.map((tc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[11px] text-accent-foreground"
              >
                <Wrench className="h-3 w-3 text-accent" />
                <span className="text-accent">{tc.agent}</span>
                <span className="text-muted-foreground">executed</span>
                <span className="font-semibold">{tc.tool}</span>
              </span>
            ))}
          </div>
        )}
        {(message.content || streaming) && (
          <div
            className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
            }`}
          >
            <MarkdownLite text={message.content} />
            {streaming && message.role === "assistant" && (
              <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal markdown: bold + lists + line breaks. Avoids extra dependency.
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isList = /^\s*[-*]\s+/.test(line);
        const content = line.replace(/^\s*[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        return (
          <div key={i} className={isList ? "ml-4 list-disc" : ""}>
            {isList ? <span className="mr-1">•</span> : null}
            <span dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      })}
    </>
  );
}