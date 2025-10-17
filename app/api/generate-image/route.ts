import OpenAI from "openai";
import { NextResponse } from "next/server";

/** Exact sizes supported by the OpenAI Images API (SDK typing union). */
type AllowedSize =
  | "auto"
  | "256x256"
  | "512x512"
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "1024x1792"
  | "1792x1024";

/** Runtime set for validation + TS type guard. */
const ALLOWED_SIZES: ReadonlySet<AllowedSize> = new Set<AllowedSize>([
  "auto",
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
]);

function isAllowedSize(s: unknown): s is AllowedSize {
  return typeof s === "string" && (ALLOWED_SIZES as Set<string>).has(s);
}

const DEFAULT_SIZE: AllowedSize = "1536x1024";

type GenerateBody = {
  prompt?: unknown;
  size?: unknown;
};

export async function POST(req: Request) {
  try {
    const body: GenerateBody = await req.json();

    // Validate prompt
    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }
    const prompt = body.prompt;

    // Validate & narrow size
    const size: AllowedSize = isAllowedSize(body.size) ? body.size : DEFAULT_SIZE;

    // ✅ Instantiate OpenAI *inside* the handler so builds won't crash
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Return a clean error at runtime instead of throwing at build time
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }
    const openai = new OpenAI({ apiKey });

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "No image data returned." }, { status: 502 });
    }

    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}` });
  } catch (err: unknown) {
    let message = "Image generation failed.";
    let status = 500;
    if (typeof err === "object" && err !== null) {
      const e = err as {
        message?: string;
        status?: number;
        response?: { data?: { error?: { message?: string } } };
      };
      message = e.response?.data?.error?.message ?? e.message ?? message;
      status = typeof e.status === "number" ? e.status : status;
    }
    // eslint-disable-next-line no-console
    console.error("OpenAI image error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
