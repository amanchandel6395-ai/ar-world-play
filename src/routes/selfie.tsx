import { createFileRoute } from "@tanstack/react-router";
import { SelfieAR } from "@/components/ar/SelfieAR";

export const Route = createFileRoute("/selfie")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Selfie AR test · ZUITAR AR PoC" },
      { name: "description", content: "Front-camera face tracking, segmentation and WebGL AR rendering test." },
      { property: "og:title", content: "Selfie AR test · ZUITAR AR PoC" },
      { property: "og:description", content: "Front-camera face tracking, segmentation and WebGL AR rendering test." },
    ],
  }),
  component: SelfieAR,
});
