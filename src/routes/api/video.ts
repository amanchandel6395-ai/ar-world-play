import { createFileRoute } from "@tanstack/react-router";

/**
 * AI Video generation endpoint.
 * Video generation is disabled per project configuration and security review.
 * Any request returns 403 Forbidden to prevent unauthorized AI job creation.
 */
export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          { error: "Video generation feature is disabled", code: "disabled" },
          { status: 403 }
        );
      },
      GET: async () => {
        return Response.json(
          { error: "Video generation feature is disabled", code: "disabled" },
          { status: 403 }
        );
      },
    },
  },
});
