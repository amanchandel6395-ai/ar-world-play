import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { createShare } from "@/lib/share.functions";
import { KIOSK, useIdleReset } from "@/lib/kiosk";
import type { SceneId } from "@/ar/scenes";

async function toBase64(b: Blob) {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ResultView({
  photo,
  sceneId,
  allowAi,
  onRetake,
  onHome,
}: {
  photo: Blob;
  sceneId: SceneId;
  allowAi: boolean;
  onRetake: () => void;
  onHome: () => void;
}) {
  const [aiPhoto, setAiPhoto] = useState<Blob | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const share = useServerFn(createShare);
  useIdleReset(KIOSK.resultTimeoutMs, onHome);

  const current = showAi && aiPhoto ? aiPhoto : photo;
  const url = useMemo(() => URL.createObjectURL(current), [current]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = showAi ? "zuitar-ai-generated.jpg" : "zuitar-photo.jpg";
    a.click();
  };

  const makeQr = async () => {
    setQrBusy(true);
    setMsg(null);
    try {
      const { token } = await share({ data: { imageBase64: await toBase64(current), aiGenerated: showAi } });
      const link = `${window.location.origin}/r/${token}`;
      setQr(await QRCode.toDataURL(link, { width: 640, margin: 1 }));
    } catch {
      setMsg("Couldn't create the QR code. Please try again.");
    } finally {
      setQrBusy(false);
    }
  };

  const enhance = async () => {
    setAiBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("image", photo, "capture.jpg");
      fd.append("scene", sceneId);
      const res = await fetch("/api/enhance", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { b64 } = (await res.json()) as { b64: string };
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      setAiPhoto(new Blob([bin], { type: "image/jpeg" }));
      setShowAi(true);
      setQr(null);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "AI enhancement failed.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-stage lg:flex-row">
      <div className="relative flex flex-1 items-center justify-center p-4 lg:p-8">
        <img src={url} alt="Your ZUITAR photo" className="max-h-[70dvh] w-auto max-w-full rounded-2xl shadow-2xl lg:max-h-[88dvh]" />
        {showAi && (
          <span className="absolute left-6 top-6 rounded-full bg-warning px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-background lg:left-12 lg:top-12">
            AI Generated
          </span>
        )}
        {aiBusy && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-overlay px-6 py-4 text-lg">Enhancing with AI…</div>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 p-4 pb-8 lg:w-[26rem] lg:justify-center lg:p-8">
        {qr ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 text-center">
            <p className="text-xl font-bold">Scan to get your photo</p>
            <img src={qr} alt="QR code to download your photo" className="w-64 rounded-lg bg-foreground p-2 lg:w-72" />
            <p className="text-sm text-muted-foreground">Link expires in 24 hours</p>
            <button onClick={() => setQr(null)} className="zt-btn-ghost">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={download} className="zt-btn-primary">
                Download
              </button>
              <button onClick={makeQr} disabled={qrBusy} className="zt-btn-secondary">
                {qrBusy ? "Creating…" : "Scan QR"}
              </button>
              <button onClick={onRetake} className="zt-btn-secondary">
                Retake
              </button>
              <button onClick={onHome} className="zt-btn-secondary">
                Home
              </button>
            </div>
            {allowAi && !aiPhoto && (
              <button onClick={enhance} disabled={aiBusy} className="zt-btn-ghost border border-border">
                ✦ AI enhance (creates an AI-generated version)
              </button>
            )}
            {aiPhoto && (
              <button onClick={() => { setShowAi((v) => !v); setQr(null); }} className="zt-btn-ghost border border-border">
                {showAi ? "Show original photo" : "Show AI-generated version"}
              </button>
            )}
            <button disabled className="zt-btn-ghost opacity-60">
              Video coming soon
            </button>
          </>
        )}
        {msg && <p className="text-center text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
