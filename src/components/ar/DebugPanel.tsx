export type DebugRow = { label: string; value: string; state?: "on" | "off" | "warn" | "info" };

const dot: Record<NonNullable<DebugRow["state"]>, string> = {
  on: "bg-primary",
  off: "bg-destructive",
  warn: "bg-warning",
  info: "bg-accent",
};

export function DebugPanel({ rows, title = "AR DEBUG" }: { rows: DebugRow[]; title?: string }) {
  return (
    <div className="pointer-events-auto w-64 rounded-md border border-border bg-overlay p-3 font-mono text-[11px] leading-5 text-foreground backdrop-blur">
      <div className="mb-1 text-[10px] tracking-widest text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="flex items-center gap-1.5 text-right">
            {r.state && <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot[r.state]}`} />}
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  const br = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua)
    ? "Chrome"
    : /Edg/.test(ua)
      ? "Edge"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const touch = navigator.maxTouchPoints > 0 ? "touch" : "no-touch";
  return `${os} · ${br} · ${touch}`;
}
