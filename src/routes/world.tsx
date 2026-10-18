import { createFileRoute } from "@tanstack/react-router";
import { WorldAR } from "@/components/ar/WorldAR";

export const Route = createFileRoute("/world")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "World AR test · ZUITAR AR PoC" },
      {
        name: "description",
        content: "Back-camera WebXR world tracking, hit-test and anchored AR subject test.",
      },
      { property: "og:title", content: "World AR test · ZUITAR AR PoC" },
      {
        property: "og:description",
        content: "Back-camera WebXR world tracking, hit-test and anchored AR subject test.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorldAR,
});
