import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ error: "Endpoint not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        return new Response(JSON.stringify({ error: "Endpoint not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
