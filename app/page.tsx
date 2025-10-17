"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

/**
 * Sublimation Nation — Generator + Editor (TS + ESLint clean)
 * - Both presets generate at 1536×1024
 * - Editor canvases:
 *     Mugs:     7.5″ × 4.5″  @ 300 DPI
 *     Tumblers: 9.7″ × 8.2″  @ 300 DPI
 */

export default function Page() {
  return <SublimationNationApp />;
}

/* ----------------------------- Types ----------------------------- */

type Preset = {
  label: string;
  value: string; // OpenAI-supported size string
  w: number;
  h: number;
  editorInches: { w: number; h: number };
};

type BaseNode = {
  id: string;
  type: "image" | "text";
  x: number; // px in export space
  y: number; // px in export space
  rotation: number; // degrees
  scale: number; // uniform
};

type ImageNode = BaseNode & {
  type: "image";
  src: string;
  naturalW: number;
  naturalH: number;
};

type TextNode = BaseNode & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
};

type NodeItem = ImageNode | TextNode;

/* ----------------------------- Config & Utils ----------------------------- */

const PRINT_DPI = 300;

const SIZE_PRESETS: Readonly<Preset[]> = [
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
      {/* blobs */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 bg-fuchsia-300/40 blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-10 -left-10 h-64 w-64 bg-sky-300/40 blur-3xl rounded-full" />

      {/* Hero */}
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
  // generation state
  const [selection, setSelection] = useState<Preset>(SIZE_PRESETS[0]);
  const [prompt, setPrompt] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"generate" | "edit">("generate");

  // editor state
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // canvas
  const viewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // prompt auto-append size
  const finalPrompt = useMemo<string>(() => {
    const sizeNote = `\n\nOutput size: ${selection.value}`;
    return `${prompt.trim()}${sizeNote}`.trim();
  }, [prompt, selection]);

  // preview aspect (based on generation size)
  const aspect = selection.w / selection.h;

  // export canvas (print) size
  const inches = selection.editorInches;
  const canvasPx = { w: inchesToPixels(inches.w), h: inchesToPixels(inches.h) };

  // on-screen scale so big canvases fit UI
  const displayMax = 560;
  const displayScale = Math.min(1, displayMax / canvasPx.w);

  // load generated image element
  const generatedImage = useImage(imageUrl);

  // cache images for nodes
  const [imageCache, setImageCache] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    nodes.forEach((n) => {
      if (n.type === "image" && !imageCache[n.id]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setImageCache((p) => ({ ...p, [n.id]: img }));
        img.src = (n as ImageNode).src;
      }
    });
  }, [nodes, imageCache]); // include imageCache to satisfy the hook rule

  // draw canvas
  useEffect(() => {
    const canvas = viewCanvasRef.current;
    if (!canvas) return;
    canvas.width = Math.floor(canvasPx.w * displayScale);
    canvas.height = Math.floor(canvasPx.h * displayScale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw nodes
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
        const w = (n as ImageNode).naturalW;
        const h = (n as ImageNode).naturalH;
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        const t = n as TextNode;
        ctx.fillStyle = t.fill;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.08)";
        ctx.shadowBlur = 6;
        ctx.font = `${t.fontSize * displayScale}px ${t.fontFamily}`;
        ctx.fillText(t.text, 0, 0);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    });

    // selection outline
    if (selectedId) {
      const n = nodes.find((x) => x.id === selectedId);
      if (n) {
        ctx.save();
        const cx = n.x * displayScale;
        const cy = n.y * displayScale;
        const s = n.scale * displayScale;
        const r = degToRad(n.rotation || 0);
        ctx.translate(cx, cy);
        ctx.rotate(r);
        ctx.scale(s, s);
        ctx.strokeStyle = "#6d28d9";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        if (n.type === "image") {
          const w = (n as ImageNode).naturalW;
          const h = (n as ImageNode).naturalH;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
        } else {
          const t = n as TextNode;
          ctx.font = `${t.fontSize * displayScale}px ${t.fontFamily}`;
          const metrics = ctx.measureText(t.text || " ");
          const w = metrics.width;
          const h = t.fontSize * displayScale;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
      }
    }
  }, [nodes, selectedId, canvasPx.w, canvasPx.h, displayScale, imageCache]);

  /* ----------------------------- Handlers ----------------------------- */

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
      const data: { imageUrl?: string } = await res.json();
      if (!data || !data.imageUrl) throw new Error("No imageUrl returned by server.");
      setImageUrl(data.imageUrl);
    } catch (e: unknown) {
      const message = typeof e === "object" && e && "toString" in e ? String(e) : "Image generation failed.";
      setError(message);
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
    const imageNode: ImageNode = {
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

  function addText() {
    const id = `txt_${Date.now()}`;
    const textNode: TextNode = {
      id,
      type: "text",
      text: "Your text",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 72,
      fill: "#111827",
      x: canvasPx.w / 2,
      y: canvasPx.h / 2,
      rotation: 0,
      scale: 1,
    };
    setNodes((prev) => [...prev, textNode]);
    setSelectedId(id);
  }

  function selectAtPoint(clientX: number, clientY: number) {
    const canvas = viewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const cx = n.x * displayScale;
      const cy = n.y * displayScale;
      const s = n.scale * displayScale;
      const r = -degToRad(n.rotation || 0);
      const dx = vx - cx;
      const dy = vy - cy;
      const rx = dx * Math.cos(r) - dy * Math.sin(r);
      const ry = dx * Math.sin(r) + dy * Math.cos(r);
      const lx = rx / s;
      const ly = ry / s;

      if (n.type === "image") {
        const w = (n as ImageNode).naturalW;
        const h = (n as ImageNode).naturalH;
        if (lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2) {
          setSelectedId(n.id);
          dragOffsetRef.current = { dx: lx, dy: ly };
          return;
        }
      } else {
        const t = n as TextNode;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.font = `${t.fontSize * displayScale}px ${t.fontFamily}`;
        const w = ctx.measureText(t.text || " ").width / displayScale;
        const h = t.fontSize;
        if (lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2) {
          setSelectedId(n.id);
          dragOffsetRef.current = { dx: lx, dy: ly };
          return;
        }
      }
    }
    setSelectedId(null);
    dragOffsetRef.current = null;
  }

  function onMouseDown(e: React.MouseEvent) {
    isDraggingRef.current = true;
    selectAtPoint(e.clientX, e.clientY);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDraggingRef.current || !selectedId) return;
    const canvas = viewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return;
    const off = dragOffsetRef.current || { dx: 0, dy: 0 };

    const s = n.scale * displayScale;
    const r = degToRad(n.rotation || 0);
    const lx = off.dx * s;
    const ly = off.dy * s;
    const rx = lx * Math.cos(r) - ly * Math.sin(r);
    const ry = lx * Math.sin(r) + ly * Math.cos(r);

    const cx = vx - rx;
    const cy = vy - ry;

    setNodes((prev) =>
      prev.map((m) => (m.id === n.id ? { ...m, x: cx / displayScale, y: cy / displayScale } : m))
    );
  }
  function onMouseUp() {
    isDraggingRef.current = false;
    dragOffsetRef.current = null;
  }

  function updateSelected(patch: Partial<NodeItem>) {
    if (!selectedId) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, ...patch } as NodeItem : n)));
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
        const w = (n as ImageNode).naturalW;
        const h = (n as ImageNode).naturalH;
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        const t = n as TextNode;
        ctx.fillStyle = t.fill;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${t.fontSize}px ${t.fontFamily}`;
        ctx.fillText(t.text, 0, 0);
      }
      ctx.restore();
    });

    const url = off.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `design_${inches.w}x${inches.h}_in_${PRINT_DPI}dpi.png`;
    a.click();
  }

  /* ----------------------------- UI ----------------------------- */

  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {step === "generate" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <section className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1">
                  <label htmlFor="prompt" className="block text-sm font-medium mb-1">
                    Prompt
                  </label>
                  <textarea
                    id="prompt"
                    placeholder="Describe your design… colors, vibe, subject, style"
                    className="w-full h-36 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-200/60"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    We’ll auto-append{" "}
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Output size: {selection.value}</span>.
                  </p>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <label htmlFor="size" className="text-xs font-medium">
                    Preset
                  </label>
                  <select
                    id="size"
                    className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-fuchsia-200/60 shadow-sm"
                    value={selection.label}
                    onChange={(e) => {
                      const picked = SIZE_PRESETS.find((s) => s.label === e.target.value) || SIZE_PRESETS[0];
                      setSelection(picked);
                    }}
                  >
                    {SIZE_PRESETS.map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-sky-600 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isGenerating ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                        <path dName="spinner" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                      </svg>
                      Generating…
                    </span>
                  ) : (
                    "Generate"
                  )}
                </button>

                <button
                  onClick={goToEditor}
                  disabled={!imageUrl || !generatedImage}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold bg-white text-gray-900 border border-gray-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next → Edit
                </button>

                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </section>

            {/* Live Preview */}
            <section className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Live Preview</h2>
                <span className="text-[11px] text-gray-600 font-mono inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                  {selection.value}
                </span>
              </div>

              <div className="relative w-full" style={{ aspectRatio: `${aspect}` }}>
                <div className="absolute inset-0 grid place-items-center rounded-2xl border border-dashed border-gray-300 bg-white overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-50"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, rgba(231,70,148,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(56,189,248,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(16,185,129,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(99,102,241,0.06) 75%)",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                    }}
                  />
                  {!imageUrl ? (
                    <div className="text-center p-6 text-gray-500 text-sm">
                      <p className="font-medium mb-1">Your image will appear here</p>
                      <p>
                        Pick a preset, write your prompt, then click <span className="font-semibold">Generate</span>.
                      </p>
                    </div>
                  ) : (
                    <div className="relative w-full h-[300px] md:h-[420px]">
                      <Image
                        src={imageUrl}
                        alt="Generated preview"
                        fill
                        className="object-contain rounded-xl"
                        unoptimized
                        priority
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* ------------------------- EDITOR STEP ------------------------- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas */}
            <section className="lg:col-span-2 bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">
                  Editor — {inches.w}″ × {inches.h}″ @ {PRINT_DPI} DPI
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setStep("generate")} className="rounded-2xl border px-3 py-1.5 text-sm bg-white/90 hover:bg-white">
                    ← Back
                  </button>
                  <button onClick={exportPNG} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 text-white px-3 py-1.5 text-sm shadow-lg hover:shadow-xl">
                    Export PNG
                  </button>
                </div>
              </div>

              <div className="overflow-auto rounded-2xl border border-dashed border-fuchsia-300/60 p-3 bg-white/60">
                <div className="rounded-2xl bg-white shadow-inner ring-4 ring-offset-2 ring-offset-white ring-sky-200/60">
                  <canvas
                    ref={viewCanvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    style={{
                      display: "block",
                      width: Math.floor(canvasPx.w * displayScale),
                      height: Math.floor(canvasPx.h * displayScale),
                      cursor: selectedId ? "move" : "default",
                      background: "#fff",
                      borderRadius: 16,
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-600 mt-3">
                Tip: Click an item to select, then drag to move. Use the sidebar to scale/rotate. Anything outside the white area is cropped on export.
              </p>
            </section>

            {/* Tools */}
            <aside className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-white/60 p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={addText} className="rounded-2xl border px-3 py-1.5 text-sm bg-white hover:shadow">
                  Add Text
                </button>
                <button
                  onClick={() => selectedId && setNodes((prev) => prev.filter((n) => n.id !== selectedId))}
                  disabled={!selectedId}
                  className="rounded-2xl border px-3 py-1.5 text-sm disabled:opacity-50 bg-white hover:shadow"
                >
                  Delete Selected
                </button>
              </div>

              {selectedId ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Selected Layer</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs">
                      X (px)
                      <input
                        type="number"
                        className="w-full rounded-xl border px-2 py-1 text-sm"
                        value={Math.round((nodes.find((n) => n.id === selectedId)?.x) ?? 0)}
                        onChange={(e) => updateSelected({ x: parseInt(e.target.value || "0", 10) })}
                      />
                    </label>
                    <label className="text-xs">
                      Y (px)
                      <input
                        type="number"
                        className="w-full rounded-xl border px-2 py-1 text-sm"
                        value={Math.round((nodes.find((n) => n.id === selectedId)?.y) ?? 0)}
                        onChange={(e) => updateSelected({ y: parseInt(e.target.value || "0", 10) })}
                      />
                    </label>
                    <label className="text-xs">
                      Scale
                      <input
                        type="range"
                        min={0.1}
                        max={5}
                        step={0.01}
                        className="w-full accent-fuchsia-600"
                        value={(nodes.find((n) => n.id === selectedId)?.scale) ?? 1}
                        onChange={(e) => updateSelected({ scale: parseFloat(e.target.value) })}
                      />
                    </label>
                    <label className="text-xs">
                      Rotation
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        className="w-full accent-sky-600"
                        value={Math.round((nodes.find((n) => n.id === selectedId)?.rotation) ?? 0)}
                        onChange={(e) => updateSelected({ rotation: parseInt(e.target.value, 10) })}
                      />
                    </label>
                  </div>

                  {/* Text-only controls */}
                  {(() => {
                    const sel = nodes.find((n) => n.id === selectedId);
                    if (!sel || sel.type !== "text") return null;
                    const t = sel as TextNode;
                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold">Text Settings</h4>
                        <input
                          type="text"
                          className="w-full rounded-2xl border px-3 py-2 text-sm"
                          value={t.text || ""}
                          onChange={(e) => updateSelected({ text: e.target.value })}
                        />
                        <div className="flex items-center gap-3">
                          <label className="text-xs w-24">Font family</label>
                          <select
                            className="flex-1 rounded-2xl border px-3 py-2 text-sm"
                            value={t.fontFamily || "Inter, system-ui, sans-serif"}
                            onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                          >
                            <option value="Inter, system-ui, sans-serif">Inter</option>
                            <option value="Impact, sans-serif">Impact</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="Courier New, monospace">Courier New</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs w-24">Font size</label>
                          <input
                            type="number"
                            className="flex-1 rounded-2xl border px-3 py-2 text-sm"
                            min={8}
                            max={600}
                            value={Math.round(t.fontSize ?? 72)}
                            onChange={(e) => updateSelected({ fontSize: parseInt(e.target.value || "72", 10) })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs w-24">Color</label>
                          <input
                            type="color"
                            className="h-9 w-16 rounded"
                            value={t.fill || "#111827"}
                            onChange={(e) => updateSelected({ fill: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 text-xs text-gray-500">
                    <p>
                      Canvas: {inches.w}″ × {inches.h}″ ({canvasPx.w}×{canvasPx.h}px @ {PRINT_DPI} DPI). Export is clipped to this area.
                    </p>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
