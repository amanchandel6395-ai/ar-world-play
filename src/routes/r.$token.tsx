import { createFileRoute } from "@tanstack/react-router";
import { getShare } from "@/lib/share.functions";

export const Route = createFileRoute("/r/$token")({
  loader: async ({ params }) => {
    if (!/^[a-f0-9]{48}$/.test(params.token)) return { status: "expired" as const };
    return getShare({ data: { token: params.token } });
  },
  head: () => ({
    meta: [
      { title: "Your ZUITAR photo" },
      { name: "description", content: "View and download your ZUITAR photo." },
      { property: "og:title", content: "Your ZUITAR photo" },
      { property: "og:description", content: "View and download your ZUITAR photo." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const d = Route.useLoaderData();
  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-stage px-4 py-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">ZUITAR</p>
      {d.status === "ok" ? (
        <>
          <div className="relative w-full max-w-lg">
            <img src={d.url} alt="Your ZUITAR photo" className="w-full rounded-2xl shadow-2xl" />
            {d.aiGenerated && (
              <span className="absolute left-3 top-3 rounded-full bg-warning px-3 py-1 text-xs font-bold uppercase tracking-wider text-background">
                AI Generated
              </span>
            )}
          </div>
          <a href={d.downloadUrl} className="zt-btn-primary w-full max-w-lg">
            Download
          </a>
          <p className="text-sm text-muted-foreground">
            Available until {new Date(d.expiresAt).toLocaleString()}
          </p>
        </>
      ) : (
        <div className="mt-20 max-w-sm">
          <h1 className="text-2xl font-bold">This link has expired</h1>
          <p className="mt-2 text-muted-foreground">Photo links are kept for 24 hours.</p>
        </div>
      )}
    </main>
  );
}
