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

const ALLOWED_SIZES = new Set<AllowedSize>([
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

// Allow selecting model via env (OpenAI vs Azure)
const ENV_MODEL = (process.env.OPENAI_IMAGE_MODEL || "").trim();
// Default to OpenAI’s model; Azure typically uses "dall-e-3"
const DEFAULT_MODEL = (ENV_MODEL || "gpt-image-1") as
  | "gpt-image-1"
  | "dall-e-3"
  | (string & {}); // keep it flexible if you override

type GenerateBody = {
  prompt?: unknown;
  size?: unknown;
};

export async function POST(req: Request) {
  try {
    const body: GenerateBody = await req.json();

    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }
    const prompt = body.prompt;
    const size: AllowedSize = isAllowedSize(body.size) ? body.size : DEFAULT_SIZE;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    // Optional provider config
    // - OpenAI (default): no baseURL needed
    // - Azure OpenAI: set OPENAI_BASE_URL=https://<resource>.openai.azure.com/openai
    //                 set AZURE_OPENAI_API_VERSION=2024-02-01 (or newer)
    //                 set OPENAI_IMAGE_MODEL=dall-e-3  (Azure doesn’t expose gpt-image-1)
    // - OpenRouter: NOT SUPPORTED for images (will return a clear error)
    const baseURL = process.env.OPENAI_BASE_URL?.trim();
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

    // Construct client at request time (avoids build-time crashes)
    const client = new OpenAI({
      apiKey,
      ...(baseURL
        ? {
            baseURL,
            // Azure requires api-version query param
            ...(azureApiVersion ? { defaultQuery: { "api-version": azureApiVersion } } : {}),
          }
        : {}),
    });

    // Guard against unsupported routers (e.g., OpenRouter)
    if (baseURL && baseURL.includes("openrouter.ai")) {
      return NextResponse.json(
        {
          error:
            "This server is configured for OpenRouter, which does not provide gpt-image-1/dall-e-3 image generation. Use a native OpenAI API key (platform.openai.com), or point baseURL to Azure OpenAI and set OPENAI_IMAGE_MODEL=dall-e-3.",
        },
        { status: 400 }
      );
    }

    // Choose model (OpenAI default = gpt-image-1; Azure = dall-e-3)
    const model = DEFAULT_MODEL;

    const result = await client.images.generate({
      model,
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
      message =
        e.response?.data?.error?.message ??
        e.message ??
        message;

      // Common provider hint surfaced by some routers:
      if (typeof message === "string" && /suitable provider/i.test(message)) {
        message =
          "The configured provider does not support this image model. Use a native OpenAI key (no baseURL), or set OPENAI_BASE_URL to your Azure endpoint and OPENAI_IMAGE_MODEL=dall-e-3.";
      }

      status = typeof e.status === "number" ? e.status : status;
    }

    // eslint-disable-next-line no-console
    console.error("OpenAI image error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
