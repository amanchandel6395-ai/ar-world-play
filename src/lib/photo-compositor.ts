/**
 * Photo Compositor for ZUITAR
 * Seamlessly creates high-definition photo booth composites of the user
 * with CM Yogi Ji, PM Modi Ji, or official BJP campaign branding.
 */

export interface CompositeOptions {
  scene: "yogi" | "modi" | "bjp" | "photo" | "demo" | string;
  interaction?: string;
  slogan?: string;
  candidateName?: string;
  candidateConstituency?: string;
}

export async function createLeaderComposite(
  userPhotoSrc: string,
  opts: CompositeOptions,
): Promise<string> {
  if (typeof window === "undefined" || !userPhotoSrc) {
    return userPhotoSrc;
  }

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });

  try {
    const userImg = await loadImage(userPhotoSrc);

    // Target dimensions (standard 3:4 vertical mobile/kiosk portrait)
    const W = 1080;
    const H = 1440;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return userPhotoSrc;

    // 1. Draw Background: Warm festive studio lighting with subtle saffron-to-stage gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#1a0f05");
    bgGrad.addColorStop(0.5, "#2d1607");
    bgGrad.addColorStop(1, "#0d0905");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Draw Customer Photo in the frame (Left-to-Center composition)
    const userAspect = userImg.width / userImg.height;
    let drawW = W;
    let drawH = W / userAspect;
    let drawX = 0;
    let drawY = 0;

    if (drawH < H) {
      drawH = H;
      drawW = H * userAspect;
      drawX = (W - drawW) / 2;
    } else {
      drawY = (H - drawH) / 2;
    }

    // In Yogi/Modi companion shots, shift customer slightly left so leader stands comfortably on right
    if (opts.scene === "yogi" || opts.scene === "modi") {
      drawX = Math.min(drawX, -W * 0.12);
    }

    ctx.drawImage(userImg, drawX, drawY, drawW, drawH);

    // Subtle warm studio lighting overlay
    const lightGrad = ctx.createRadialGradient(W * 0.5, H * 0.35, 100, W * 0.5, H * 0.5, W * 0.8);
    lightGrad.addColorStop(0, "rgba(255, 153, 51, 0.12)");
    lightGrad.addColorStop(0.7, "rgba(255, 102, 0, 0.05)");
    lightGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, W, H);

    // 3. Draw Leader Cutout if selected (CM Yogi or PM Modi)
    let leaderPath: string | null = null;
    if (opts.scene === "yogi") leaderPath = "/assets/yogi.png";
    if (opts.scene === "modi") leaderPath = "/assets/modi.png";

    if (leaderPath) {
      try {
        const leaderImg = await loadImage(leaderPath);
        // Leader stands on the right half, bottom aligned, realistic height (~82% of screen)
        const leaderH = Math.round(H * 0.82);
        const leaderW = Math.round((leaderImg.width / leaderImg.height) * leaderH);
        const leaderX = Math.round(W - leaderW + W * 0.04);
        const leaderY = Math.round(H - leaderH - H * 0.06);

        // Soft drop shadow behind leader for natural depth
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
        ctx.shadowBlur = 35;
        ctx.shadowOffsetX = -10;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(leaderImg, leaderX, leaderY, leaderW, leaderH);
        ctx.restore();
      } catch (err) {
        console.warn("Could not load leader image for composite:", err);
      }
    }

    // 4. Draw BJP Look elements (if scene === 'bjp')
    if (opts.scene === "bjp") {
      try {
        const bjpLogo = await loadImage("/assets/bjp.png");
        // Prominent BJP Lotus badge at top right
        const logoSize = Math.round(W * 0.22);
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 15;
        ctx.drawImage(bjpLogo, W - logoSize - 30, 40, logoSize, Math.round(logoSize * 0.85));
        ctx.restore();
      } catch {}
    }

    // 5. Draw Official Top Badge: Lotus + "बोलता पोस्टर अभियान · ZUITAR"
    ctx.save();
    const topBarHeight = 54;
    const topBarY = 24;
    const topBarW = Math.round(W * 0.72);
    const topBarX = Math.round((W - topBarW) / 2);

    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = "rgba(255, 153, 51, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(topBarX, topBarY, topBarW, topBarHeight, 27);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFB347";
    ctx.font = 'bold 20px "Space Grotesk", "Noto Sans Devanagari", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🪷 बोलता पोस्टर अभियान · ZUITAR", W / 2, topBarY + topBarHeight / 2);
    ctx.restore();

    // 6. Draw Official Bottom Slogan Banner
    const bannerH = Math.round(H * 0.12);
    const bannerY = H - bannerH;

    // Rich gradient background for footer banner
    const bannerGrad = ctx.createLinearGradient(0, bannerY, 0, H);
    bannerGrad.addColorStop(0, "rgba(10, 10, 18, 0.95)");
    bannerGrad.addColorStop(1, "rgba(5, 5, 8, 0.99)");
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, bannerY, W, bannerH);

    // Vibrant saffron top accent border
    ctx.fillStyle = "#FF9933";
    ctx.fillRect(0, bannerY, W, 5);

    // Slogan Text
    const primarySlogan =
      opts.slogan ||
      (opts.scene === "yogi"
        ? "बुलडोज़र बाबा की जय · सुशासन और सुरक्षा 🚩"
        : opts.scene === "modi"
          ? "एक भारत, श्रेष्ठ भारत 🇮🇳 · अबकी बार 400 पार"
          : "सेवा, सुशासन और गरीब कल्याण 🪷");

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 8;

    // Line 1: Slogan
    ctx.fillStyle = "#FFFFFF";
    ctx.font = 'bold 28px "Space Grotesk", "Noto Sans Devanagari", sans-serif';
    ctx.fillText(primarySlogan, W / 2, bannerY + bannerH * 0.38);

    // Line 2: Contact & Endorsement
    const subText = opts.candidateName
      ? `समर्थन: ${opts.candidateName} (${opts.candidateConstituency || "लखनऊ"}) · संपर्क: +91 9068734941`
      : "डिजिटल कैंपेन पार्टनर: ZUITAR · संपर्क: +91 9068734941 · लखनऊ, उत्तर प्रदेश";
    ctx.fillStyle = "#FFB347";
    ctx.font = '600 18px "Space Grotesk", "Noto Sans Devanagari", sans-serif';
    ctx.fillText(subText, W / 2, bannerY + bannerH * 0.74);

    return canvas.toDataURL("image/jpeg", 0.94);
  } catch (err) {
    console.error("Composite generation failed, using original:", err);
    return userPhotoSrc;
  }
}
