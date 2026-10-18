import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Render3DStyle = "standee" | "hologram" | "gold";
export type HologramColorTheme = "cyan" | "gold" | "emerald" | "white";

export interface ThreeStandeePreviewProps {
  imageUrl: string;
  thickness?: number;
  renderStyle?: Render3DStyle;
  holoTheme?: HologramColorTheme;
  autoRotate?: boolean;
  cameraView?: "front" | "back" | "top" | "low" | "iso" | null;
  onViewHandled?: () => void;
}

/**
 * ThreeStandeePreview - Blender-Grade 3D Standee & Sci-Fi Hologram
 * - 360° Spherical OrbitControls (Front, Back, Top, Bottom)
 * - 100% Faithful Photographic Colors (Zero face bleaching, sRGB calibrated)
 * - True 3D Silhouette Contour Extrusion with beveled chamfer edges
 * - Volumetric Holographic Projector base with energy rings and beam particles
 * - Dual-tier crystal acrylic pedestal base with floor AO contact shadow
 */
export function ThreeStandeePreview({
  imageUrl,
  thickness = 1.8,
  renderStyle = "standee",
  holoTheme = "cyan",
  autoRotate = false,
  cameraView = null,
  onViewHandled,
}: ThreeStandeePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(renderStyle === "hologram" ? 0x050814 : 0x0a0f1d);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 12, 115);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // True sRGB color pipeline to preserve 100% natural colors
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.replaceChildren(renderer.domElement);

    // Full 360° Orbit Controls (yaw & pitch - look up, down, front, back)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.75; // Allows looking from below (low angle)
    controls.minPolarAngle = Math.PI * 0.1; // Allows looking from direct top down
    controls.minDistance = 35;
    controls.maxDistance = 220;
    controls.target.set(0, -5, 0);
    controlsRef.current = controls;

    // Grid Floor
    const gridColor = renderStyle === "hologram" ? 0x1e3a8a : 0x334155;
    const gridCenter = renderStyle === "hologram" ? 0x38bdf8 : 0x475569;
    const grid = new THREE.GridHelper(160, 20, gridCenter, gridColor);
    grid.position.y = -35;
    scene.add(grid);

    // Calibrated natural studio softbox lighting (Soft, balanced, never washes out faces!)
    const amb = new THREE.AmbientLight(0xffffff, renderStyle === "hologram" ? 0.6 : 0.85);
    scene.add(amb);

    const key = new THREE.DirectionalLight(0xfff8eb, 0.8);
    key.position.set(35, 50, 45);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xecfeff, 0.4);
    fill.position.set(-35, 25, 30);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffedd5, 0.5);
    rim.position.set(0, 45, -45);
    scene.add(rim);

    // Color theme resolution
    let holoColorHex = 0x38bdf8;
    if (holoTheme === "gold") holoColorHex = 0xf59e0b;
    else if (holoTheme === "emerald") holoColorHex = 0x10b981;
    else if (holoTheme === "white") holoColorHex = 0xf8fafc;

    const holder = new THREE.Group();
    scene.add(holder);

    // Texture loader with sRGB
    const texLoader = new THREE.TextureLoader();
    texLoader.load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;

      const img = tex.image as HTMLImageElement;
      const aspect = (img?.width || 1) / Math.max(1, img?.height || 1);
      const h = 65;
      const w = h * aspect;

      // Extract Alpha Silhouette Contour for True 3D Extrusion
      const offCanvas = document.createElement("canvas");
      const sampleW = 120;
      const sampleH = 150;
      offCanvas.width = sampleW;
      offCanvas.height = sampleH;
      const oCtx = offCanvas.getContext("2d");

      let shape: THREE.Shape | null = null;

      if (oCtx && img) {
        try {
          oCtx.drawImage(img, 0, 0, sampleW, sampleH);
          const iData = oCtx.getImageData(0, 0, sampleW, sampleH).data;

          const leftPts: Array<{ x: number; y: number }> = [];
          const rightPts: Array<{ x: number; y: number }> = [];

          let firstY = -1;
          let lastY = -1;

          for (let y = 0; y < sampleH; y++) {
            let leftX = -1;
            let rightX = -1;
            for (let x = 0; x < sampleW; x++) {
              const alpha = iData[(y * sampleW + x) * 4 + 3]!;
              if (alpha > 35) {
                if (leftX === -1) leftX = x;
                rightX = x;
              }
            }
            if (leftX !== -1 && rightX !== -1) {
              if (firstY === -1) firstY = y;
              lastY = y;
              leftPts.push({ x: leftX, y });
              rightPts.push({ x: rightX, y });
            }
          }

          if (leftPts.length > 10 && firstY !== -1 && lastY !== -1) {
            // Smooth contour boundary with moving average
            const smoothWindow = 3;
            const smoothPts = (pts: Array<{ x: number; y: number }>) => {
              return pts.map((p, idx) => {
                let sx = 0;
                let count = 0;
                for (let k = -smoothWindow; k <= smoothWindow; k++) {
                  const target = idx + k;
                  if (target >= 0 && target < pts.length) {
                    sx += pts[target]!.x;
                    count++;
                  }
                }
                return { x: sx / count, y: p.y };
              });
            };

            const sLeft = smoothPts(leftPts);
            const sRight = smoothPts(rightPts);

            const allContour: THREE.Vector2[] = [];
            // Go down left side
            for (const p of sLeft) {
              const nx = (p.x / sampleW - 0.5) * w;
              const ny = -(p.y / sampleH - 0.5) * h;
              allContour.push(new THREE.Vector2(nx, ny));
            }
            // Go up right side
            for (let i = sRight.length - 1; i >= 0; i--) {
              const p = sRight[i]!;
              const nx = (p.x / sampleW - 0.5) * w;
              const ny = -(p.y / sampleH - 0.5) * h;
              allContour.push(new THREE.Vector2(nx, ny));
            }

            shape = new THREE.Shape(allContour);
          }
        } catch (cntErr) {
          console.warn("Contour extraction fallback:", cntErr);
        }
      }

      // Depth parameters
      const totalDepth = Math.max(0.6, thickness);

      if (shape) {
        // True 3D Extruded Geometry
        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
          depth: totalDepth,
          bevelEnabled: true,
          bevelThickness: Math.min(0.4, totalDepth * 0.3),
          bevelSize: Math.min(0.4, totalDepth * 0.3),
          bevelSegments: 2,
        });

        // Remap UVs so photo fits 1:1 on front face
        const pos = extrudeGeom.attributes.position!;
        const uv = extrudeGeom.attributes.uv!;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          uv.setXY(i, vx / w + 0.5, vy / h + 0.5);
        }

        // Materials: Index 0 = Front & Back faces, Index 1 = Sides/Bevels
        let faceMaterial: THREE.Material;
        let sideMaterial: THREE.Material;

        if (renderStyle === "standee") {
          // Front: 100% Pristine photo reproduction
          faceMaterial = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.DoubleSide,
          });
          // Sides: Polished crystal clear acrylic glass
          sideMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.08,
            metalness: 0.05,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
          });
        } else if (renderStyle === "hologram") {
          // Hologram Face: Authentic photo with energy radiance
          faceMaterial = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.DoubleSide,
          });
          // Hologram Sides: Luminous energy edge
          sideMaterial = new THREE.MeshStandardMaterial({
            color: holoColorHex,
            emissive: holoColorHex,
            emissiveIntensity: 0.9,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
          });
        } else {
          // Gold Trophy
          faceMaterial = new THREE.MeshStandardMaterial({
            map: tex,
            color: 0xfbbf24,
            roughness: 0.35,
            metalness: 0.75,
            side: THREE.DoubleSide,
          });
          sideMaterial = new THREE.MeshStandardMaterial({
            color: 0xd97706,
            roughness: 0.25,
            metalness: 0.85,
            side: THREE.DoubleSide,
          });
        }

        const extrudedMesh = new THREE.Mesh(extrudeGeom, [faceMaterial, sideMaterial]);
        extrudedMesh.position.set(0, -35 + h / 2, -totalDepth / 2);
        holder.add(extrudedMesh);
      } else {
        // Fallback: Ultra-crisp dual front/back plate with acrylic core
        const frontPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.FrontSide,
          }),
        );
        frontPlane.position.set(0, -35 + h / 2, 0);
        holder.add(frontPlane);

        const backPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.BackSide,
          }),
        );
        backPlane.position.set(0, -35 + h / 2, -totalDepth);
        holder.add(backPlane);
      }

      // Base & Pedestal / Projector Emitter
      if (renderStyle === "hologram") {
        // 1. Sci-Fi Hologram Projector Emitter Base
        const projBase = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.45, w * 0.5, 1.6, 40),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.2,
            metalness: 0.8,
          }),
        );
        projBase.position.set(0, -34.2, 0);
        holder.add(projBase);

        // Holographic Glowing Core Lens
        const lensMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.38, w * 0.38, 0.4, 40),
          new THREE.MeshBasicMaterial({
            color: holoColorHex,
            transparent: true,
            opacity: 0.9,
          }),
        );
        lensMesh.position.set(0, -33.3, 0);
        holder.add(lensMesh);

        // Concentric Holographic Ring
        const holoRing = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.42, 0.4, 16, 48),
          new THREE.MeshBasicMaterial({
            color: holoColorHex,
            transparent: true,
            opacity: 0.75,
          }),
        );
        holoRing.rotation.x = Math.PI / 2;
        holoRing.position.set(0, -33.2, 0);
        holder.add(holoRing);

        // Upward Volumetric Hologram Light Cone
        const coneGeom = new THREE.CylinderGeometry(w * 0.55, w * 0.35, h + 8, 32, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: holoColorHex,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeom, coneMat);
        coneMesh.position.set(0, -35 + (h + 8) / 2, 0);
        holder.add(coneMesh);

        // Floating Holographic Sparkle Dust Particles
        const particleCount = 75;
        const pGeom = new THREE.BufferGeometry();
        const pPos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
          pPos[i * 3] = (Math.random() - 0.5) * w * 0.9;
          pPos[i * 3 + 1] = -33 + Math.random() * h;
          pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
        }
        pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
        const pMat = new THREE.PointsMaterial({
          color: holoColorHex,
          size: 1.2,
          transparent: true,
          opacity: 0.65,
        });
        const pSystem = new THREE.Points(pGeom, pMat);
        holder.add(pSystem);
      } else {
        // Physical Standee: Double-Tier Acrylic Pedestal Base & Floor Shadow
        const sCanvas = document.createElement("canvas");
        sCanvas.width = 128;
        sCanvas.height = 64;
        const sctx = sCanvas.getContext("2d")!;
        const grad = sctx.createRadialGradient(64, 32, 2, 64, 32, 58);
        grad.addColorStop(0, "rgba(5, 8, 15, 0.75)");
        grad.addColorStop(0.4, "rgba(5, 8, 15, 0.25)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 128, 64);
        const sTex = new THREE.CanvasTexture(sCanvas);

        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 1.3, 26),
          new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, -34.88, 0);
        holder.add(shadow);

        // Lower Acrylic Disc
        const baseLower = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.44, w * 0.47, 1.2, 40),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.08,
            metalness: 0.05,
            transparent: true,
            opacity: 0.5,
          }),
        );
        baseLower.position.set(0, -34.4, 0);
        holder.add(baseLower);

        // Upper Chamfer Disc
        const baseUpper = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.36, w * 0.38, 0.7, 40),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.05,
            metalness: 0.15,
            transparent: true,
            opacity: 0.65,
          }),
        );
        baseUpper.position.set(0, -33.6, 0);
        holder.add(baseUpper);

        // Metallic Accent Ring
        const metalRing = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.37, 0.35, 16, 40),
          new THREE.MeshStandardMaterial({
            color: renderStyle === "gold" ? 0xf59e0b : 0xe2e8f0,
            roughness: 0.25,
            metalness: 0.85,
          }),
        );
        metalRing.rotation.x = Math.PI / 2;
        metalRing.position.set(0, -33.6, 0);
        holder.add(metalRing);
      }
    });

    let animId: number;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.016;

      controls.update();

      if (autoRotate) {
        holder.rotation.y += 0.012;
      }

      // Gentle floating hover for hologram mode
      if (renderStyle === "hologram") {
        holder.position.y = Math.sin(clock * 2) * 0.45;
      } else {
        holder.position.y = 0;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
    };
  }, [imageUrl, thickness, renderStyle, holoTheme, autoRotate]);

  // Handle Preset Camera Perspectives (Front, Back, Top, Low, Iso)
  useEffect(() => {
    if (!cameraView || !controlsRef.current) return;
    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;

    if (cameraView === "front") {
      camera.position.set(0, 10, 115);
      controls.target.set(0, -5, 0);
    } else if (cameraView === "back") {
      camera.position.set(0, 10, -115);
      controls.target.set(0, -5, 0);
    } else if (cameraView === "top") {
      camera.position.set(0, 95, 20);
      controls.target.set(0, -5, 0);
    } else if (cameraView === "low") {
      camera.position.set(0, -22, 105);
      controls.target.set(0, -5, 0);
    } else if (cameraView === "iso") {
      camera.position.set(65, 35, 75);
      controls.target.set(0, -5, 0);
    }

    controls.update();
    onViewHandled?.();
  }, [cameraView, onViewHandled]);

  return <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}
