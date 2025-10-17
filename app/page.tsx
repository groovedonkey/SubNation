"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Sublimation Nation — Generator + Editor (plain TS-compatible)
 * - Mugs & Tumblers both generate at 1536×1024
 * - Editor windows remain:
 *     Mugs:     7.5" × 4.5"  @ 300 DPI
 *     Tumblers: 9.7" × 8.2"  @ 300 DPI
 */

export default function Page() {
  return <SublimationNationApp />;
}

/* ----------------------------- Config & Utils ----------------------------- */

const PRINT_DPI = 300;
const SIZE_PRESETS = [
  {
    label: "Mugs — 1536×1024",
    value: "1536x1024",
    w: 1536,
    h: 1024,
    editorInches: { w: 7.5, h: 4.5 },
  },
  {
    label: "Tumblers — 1536×1024",
    value: "1536x1024",
    w: 1536,
    h: 1024,
    editorInches: { w: 9.7, h: 8.2 },
  },
];

// ✅ Explicit typing fixes the Netlify build error
function inchesToPixels(inches: number, dpi: number = PRINT_DPI): number {
  return Math.round(inches * dpi);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function coverScale(containerW: number, containerH: number, innerW: number, innerH: number): number {
  return Math.max(containerW / innerW, containerH / innerH);
}
function useImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.src = url;
  }, [url]);
  return img;
}

/* ----------------------------- App Shell ----------------------------- */

function SublimationNationApp() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-sky-50 to-emerald-50 text-gray-900 relative">
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 bg-fuchsia-300/40 blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-10 -left-10 h-64 w-64 bg-sky-300/40 blur-3xl rounded-full" />

      <section className="relative">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-sm mb-3">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-700">Artsy Tools for Makers</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-fuchsia-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
            Sublimation Nation
          </h1>
          <p className="mt-3 max-w-2xl text-gray-700">
            Dream it → Generate it → Print it. Quick presets for mugs & tumblers, plus a slick editor for cropping and text.
          </p>
        </div>
      </section>

      <Studio />

      <footer className="max-w-6xl mx-auto px-6 py-12 text-xs text-gray-500">
        © {new Date().getFullYear()} Sublimation Nation — For artist & crafter entrepreneurs.
      </footer>
    </main>
  );
}

/* ----------------------------- Studio (Generator + Editor) ----------------------------- */

function Studio() {
  const [selection, setSelection] = useState(SIZE_PRESETS[0]);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"generate" | "edit">("generate");

  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const viewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const finalPrompt = useMemo(() => {
    const sizeNote = `\n\nOutput size: ${selection.value}`;
    return `${prompt.trim()}${sizeNote}`.trim();
  }, [prompt, selection]);

  const aspect = selection.w / selection.h;

  const inches = selection.editorInches;
  const canvasPx = { w: inchesToPixels(inches.w), h: inchesToPixels(inches.h) };

  const displayMax = 560;
  const displayScale = Math.min(1, displayMax / canvasPx.w);

  const generatedImage = useImage(imageUrl);
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    nodes.forEach((n) => {
      if (n.type === "image" && !imageCache[n.id]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setImageCache((p) => ({ ...p, [n.id]: img }));
        img.src = n.src;
      }
    });
  }, [nodes]);

  useEffect(() => {
    const canvas = viewCanvasRef.current;
    if (!canvas) return;
    canvas.width = Math.floor(canvasPx.w * displayScale);
    canvas.height = Math.floor(canvasPx.h * displayScale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    nodes.forEach((n) => {
      ctx.save();
      const cx = n.x * displayScale;
      const cy = n.y * displayScale;
      const s = n.scale * displayScale;
      const r = degToRad(n.rotation || 0);
      ctx.translate(cx, cy);
      ctx.rotate(r);
      ctx.scale(s, s);
      if (n.type === "image") {
        const img = imageCache[n.id];
        if (img) ctx.drawImage(img, -n.naturalW / 2, -n.naturalH / 2, n.naturalW, n.naturalH);
      } else {
        ctx.fillStyle = n.fill;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${n.fontSize * displayScale}px ${n.fontFamily}`;
        ctx.fillText(n.text, 0, 0);
      }
      ctx.restore();
    });
  }, [nodes, selectedId, canvasPx.w, canvasPx.h, displayScale, imageCache]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setImageUrl(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, size: selection.value }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data || !data.imageUrl) throw new Error("No imageUrl returned by server.");
      setImageUrl(data.imageUrl);
    } catch (e: any) {
      setError(e?.message || "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function goToEditor() {
    if (!generatedImage || !imageUrl) return;
    const pxW = canvasPx.w;
    const pxH = canvasPx.h;
    const imgW = generatedImage.width;
    const imgH = generatedImage.height;
    const scale = coverScale(pxW, pxH, imgW, imgH);
    const id = `img_${Date.now()}`;
    const imageNode = {
      id,
      type: "image",
      src: imageUrl,
      naturalW: imgW,
      naturalH: imgH,
      x: pxW / 2,
      y: pxH / 2,
      rotation: 0,
      scale,
    };
    setNodes([imageNode]);
    setSelectedId(id);
    setStep("edit");
  }

  function exportPNG() {
    const off = document.createElement("canvas");
    off.width = canvasPx.w;
    off.height = canvasPx.h;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);
    nodes.forEach((n) => {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(degToRad(n.rotation || 0));
      ctx.scale(n.scale, n.scale);
      if (n.type === "image") {
        const img = imageCache[n.id];
        if (img) ctx.drawImage(img, -n.naturalW / 2, -n.naturalH / 2, n.naturalW, n.naturalH);
      } else {
        ctx.fillStyle = n.fill;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${n.fontSize}px ${n.fontFamily}`;
        ctx.fillText(n.text, 0, 0);
      }
      ctx.restore();
    });
    const url = off.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `design_${inches.w}x${inches.h}_in_${PRINT_DPI}dpi.png`;
    a.click();
  }

  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {step === "generate" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* generator */}
            <section className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5 space-y-4">
              <textarea
                className="w-full h-36 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Describe your design..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <select
                className="rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 text-sm"
                value={selection.label}
                onChange={(e) =>
                  setSelection(SIZE_PRESETS.find((s) => s.label === e.target.value) || SIZE_PRESETS[0])
                }
              >
                {SIZE_PRESETS.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-sky-600 rounded-2xl"
                >
                  {isGenerating ? "Generating…" : "Generate"}
                </button>
                <button
                  onClick={goToEditor}
                  disabled={!imageUrl || !generatedImage}
                  className="px-5 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-2xl"
                >
                  Next → Edit
                </button>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </section>

            {/* preview */}
            <section className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5">
              <div className="relative w-full" style={{ aspectRatio: `${aspect}` }}>
                {!imageUrl ? (
                  <div className="grid place-items-center h-full text-sm text-gray-500">Your image will appear here</div>
                ) : (
                  <img
                    src={imageUrl}
                    alt="Generated preview"
                    className="max-w-full max-h-full object-contain rounded-xl"
                  />
                )}
              </div>
            </section>
          </div>
        ) : (
          <div>
            <div className="flex justify-between mb-3">
              <h2 className="text-sm font-semibold">
                Editor — {inches.w}" × {inches.h}" @ {PRINT_DPI} DPI
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setStep("generate")} className="border rounded-2xl px-3 py-1.5 text-sm">
                  ← Back
                </button>
                <button
                  onClick={exportPNG}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 text-white px-3 py-1.5 text-sm shadow-lg"
                >
                  Export PNG
                </button>
              </div>
            </div>
            <canvas
              ref={viewCanvasRef}
              style={{
                display: "block",
                width: Math.floor(canvasPx.w * displayScale),
                height: Math.floor(canvasPx.h * displayScale),
                background: "#fff",
                borderRadius: 16,
                border: "1px dashed #ccc",
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
