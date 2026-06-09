import { createFileRoute } from "@tanstack/react-router";
import { AgentFlowDemo } from "@/components/AgentFlowDemo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "A2A Agent Flow Demo — Legal Multi-Agent" }],
  }),
  component: AgentFlowDemo,
});
