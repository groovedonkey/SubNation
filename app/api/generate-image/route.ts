import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Many OpenAI image endpoints only accept these sizes (DALL·E 3 / gpt-image-1):
 *   - 1024x1024 (square)
 *   - 1792x1024 (landscape)
 *   - 1024x1792 (portrait)
 * Your UI asks for 1600x900 (≈16:9) and 800x600 (4:3). We'll map them to the closest supported sizes,
 * then you can crop/scale precisely in the editor and export at print resolution.
 */
function mapToSupportedSize(requested: string): "1024x1024" | "1792x1024" | "1024x1792" {
  if (!requested) return "1024x1024";
  const [wStr, hStr] = requested.split("x");
  const w = Number(wStr);
  const h = Number(hStr);
  if (!w || !h) return "1024x1024";

  const aspect = w / h;
  // Heuristic: 16:9 → landscape; 9:16 → portrait; otherwise square
  if (aspect > 1.5) return "1792x1024";   // landscape (close to 16:9)
  if (aspect < 0.75) return "1024x1792";  // portrait
  return "1024x1024";                     // square-ish like 4:3
}

export async function POST(req: Request) {
  try {
    const { prompt, size } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    // Map your UI size to a supported OpenAI size
    const supportedSize = mapToSupportedSize(size);

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: supportedSize,
      // You can also request: background: "transparent"  (PNG with alpha)
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "No image data returned." }, { status: 502 });
    }

    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}` });
  } catch (err: any) {
    // Surface helpful info in dev; keep it safe for prod
    const status = err?.status ?? 500;
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Image generation failed.";

    // Log full error on the server for debugging
    console.error("OpenAI image error:", err);

    return NextResponse.json({ error: message }, { status });
  }
}
