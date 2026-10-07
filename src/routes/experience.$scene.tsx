import { createFileRoute, notFound } from "@tanstack/react-router";
import { Experience } from "@/components/zuitar/Experience";
import { SCENES, isSceneId } from "@/ar/scenes";

export const Route = createFileRoute("/experience/$scene")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!isSceneId(params.scene)) throw notFound();
  },
  head: ({ params }) => {
    const s = isSceneId(params.scene) ? SCENES[params.scene] : null;
    const title = s ? `${s.title} · ZUITAR` : "ZUITAR";
    const desc = s ? `${s.subtitle} — live AR camera by ZUITAR.` : "ZUITAR live AR camera.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ExperiencePage,
});

function ExperiencePage() {
  const { scene } = Route.useParams();
  if (!isSceneId(scene)) return null;
  return <Experience key={scene} sceneId={scene} />;
}
