import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type GenerateBody = {
  prompt?: string;
  size?: "1536x1024" | "1024x1024" | "1792x1024" | "1024x1792" | string;
};

export async function POST(req: Request) {
  try {
    const { prompt, size }: GenerateBody = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: size || "1536x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "No image data returned." }, { status: 502 });
    }

    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}` });
  } catch (err: unknown) {
    // Narrow the error to surface a useful message without using `any`
    let message = "Image generation failed.";
    let status = 500;

    if (typeof err === "object" && err !== null) {
      const maybeError = err as { message?: string; status?: number; response?: { data?: { error?: { message?: string } } } };
      message =
        maybeError.response?.data?.error?.message ??
        maybeError.message ??
        message;
      status = typeof maybeError.status === "number" ? maybeError.status : status;
    }

    // Log full error for server diagnostics
    // eslint-disable-next-line no-console
    console.error("OpenAI image error:", err);

    return NextResponse.json({ error: message }, { status });
  }
}
