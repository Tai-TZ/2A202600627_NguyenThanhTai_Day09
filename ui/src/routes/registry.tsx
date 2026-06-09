import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/registry")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
