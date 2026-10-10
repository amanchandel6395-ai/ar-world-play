import { createFileRoute, notFound } from "@tanstack/react-router";
import { Experience } from "@/components/zuitar/Experience";
import { isSceneId } from "@/ar/scenes";
import { DICTS } from "@/lib/i18n";

export const Route = createFileRoute("/experience/$scene")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!isSceneId(params.scene)) throw notFound();
  },
  head: ({ params }) => {
    const s = isSceneId(params.scene)
      ? { title: DICTS.en[params.scene], subtitle: DICTS.en[`${params.scene}Sub`] }
      : null;
    const title = s ? `${s.title} · ZUITAR` : "ZUITAR";
    const desc = s ? `${s.subtitle} — live AR camera by ZUITAR.` : "ZUITAR live AR camera.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
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
