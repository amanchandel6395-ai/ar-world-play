import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { SCENES, type SceneId } from "@/ar/scenes";
import { useDevMode } from "@/lib/kiosk";
import { DICTS } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZUITAR · AI Camera + AR" },
      { name: "description", content: "Choose your experience: live AR selfies and styling with ZUITAR." },
      { property: "og:title", content: "ZUITAR · AI Camera + AR" },
      { property: "og:description", content: "Live AR selfies and styling, right in your browser." },
    ],
  }),
  component: Home,
});

const cards: { id: SceneId; kicker: string; tone: string }[] = [
  { id: "yogi", kicker: "Selfie with", tone: "from-saffron/40" },
  { id: "modi", kicker: "Selfie with", tone: "from-gold/35" },
  { id: "bjp", kicker: "Style", tone: "from-leaf/40" },
];

const names: Record<SceneId, [string, string]> = {
  yogi: ["CM Yogi", "Adityanath"],
  modi: ["PM Narendra", "Modi"],
  bjp: ["BJP", "Look"],
};

function Home() {
  const [dev, setDev] = useDevMode();
  const [flash, setFlash] = useState<string | null>(null);
  const press = useRef<number | null>(null);
  const startPress = () => {
    press.current = window.setTimeout(() => {
      setDev(!dev);
      setFlash(!dev ? "Development mode ON" : "Development mode OFF");
      window.setTimeout(() => setFlash(null), 1800);
    }, 2500);
  };
  const endPress = () => press.current && clearTimeout(press.current);

  return (
    <main className="flex min-h-dvh flex-col bg-stage px-5 py-8 text-foreground md:px-10 lg:py-12">
      <header className="flex flex-col items-center text-center">
        <h1
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          className="select-none text-5xl font-bold tracking-[0.25em] text-gradient md:text-7xl"
        >
          ZUITAR
        </h1>
        <p className="mt-3 text-lg text-muted-foreground md:text-2xl">Choose Your Experience</p>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-7xl flex-1 gap-4 md:mt-12 md:grid-cols-3 md:gap-6">
        {cards.map((c, i) => (
          <Link
            key={c.id}
            to="/experience/$scene"
            params={{ scene: c.id }}
            className={`zt-card group relative flex min-h-44 flex-col justify-end overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.tone} to-card p-6 transition-transform active:scale-[0.98] md:min-h-[24rem] md:p-8`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="absolute right-6 top-6 text-6xl font-bold text-foreground/10 md:text-8xl">0{i + 1}</span>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{c.kicker}</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
              {names[c.id][0]}
              <br />
              {names[c.id][1]}
            </h2>
            <p className="mt-2 text-muted-foreground">{DICTS.en[`${c.id}Sub`]}</p>
            <span className="mt-5 inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground">
              Start →
            </span>
          </Link>
        ))}
      </div>

      {dev && (
        <nav className="mx-auto mt-6 flex gap-3 font-mono text-xs text-muted-foreground">
          <Link to="/selfie" className="underline">engine test: selfie</Link>
          <Link to="/world" className="underline">engine test: world</Link>
        </nav>
      )}
      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-overlay px-5 py-2 text-sm">{flash}</div>
      )}
    </main>
  );
}
