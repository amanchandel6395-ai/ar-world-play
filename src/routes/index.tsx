import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZUITAR · AR Proof of Concept" },
      { name: "description", content: "Technical AR proof of concept: real face tracking, segmentation and world AR in the browser." },
      { property: "og:title", content: "ZUITAR · AR Proof of Concept" },
      { property: "og:description", content: "Real face tracking, segmentation and world AR in the browser." },
    ],
  }),
  component: Index,
});

const matrix: [string, string, string][] = [
  ["Face tracking (6DoF)", "All modern browsers", "MediaPipe FaceLandmarker"],
  ["Person segmentation / occlusion", "All modern browsers", "MediaPipe selfie segmenter"],
  ["World tracking + hit-test", "Android Chrome (ARCore) only", "WebXR immersive-ar"],
  ["Anchors / plane detection / depth", "Android Chrome, device-dependent", "WebXR optional features"],
  ["World AR on iPhone Safari", "Not available", "Safari has no WebXR AR"],
  ["Body pose tracking", "Not in this PoC yet", "MediaPipe PoseLandmarker (next step)"],
];

function Index() {
  return (
    <main className="min-h-dvh bg-background grid-bg px-5 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs tracking-widest text-primary">ZUITAR / AR PIPELINE / PoC-01</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Device-independent AR camera test</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Neutral test assets only. Every overlay is rendered in WebGL from live tracking data — nothing is positioned with CSS.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link to="/selfie" className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary">
            <p className="font-mono text-xs text-accent">A · FRONT CAMERA</p>
            <h2 className="mt-2 text-xl font-semibold">Selfie AR</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Face-anchored 3D ring orbits your head. Its back half hides behind you via live segmentation.
            </p>
            <span className="mt-4 inline-block font-mono text-xs text-primary">open →</span>
          </Link>
          <Link to="/world" className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary">
            <p className="font-mono text-xs text-accent">B · BACK CAMERA</p>
            <h2 className="mt-2 text-xl font-semibold">World AR</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Place a 1.7 m test figure on the floor. It stays anchored as you walk toward or around it.
            </p>
            <span className="mt-4 inline-block font-mono text-xs text-primary">open →</span>
          </Link>
        </div>

        <h3 className="mt-10 font-mono text-xs tracking-widest text-muted-foreground">CAPABILITY MATRIX</h3>
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          {matrix.map(([f, s, t]) => (
            <div key={f} className="grid grid-cols-3 gap-3 border-b border-border bg-card px-4 py-2.5 text-sm last:border-b-0">
              <span>{f}</span>
              <span className="text-muted-foreground">{s}</span>
              <span className="font-mono text-xs text-muted-foreground">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
