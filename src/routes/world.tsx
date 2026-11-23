import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/world")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
