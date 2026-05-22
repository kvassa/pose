import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SIGNATURE_HEADER = "X-Signature";

type CallbackBody = {
  reference_id?: string;
  error?: string;
  keypoints?: unknown;
  bounding_box?: unknown;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function expectedSignature(
  body: ArrayBuffer,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, body);
  return toHex(digest);
}

async function verifySignature(
  body: ArrayBuffer,
  secret: string,
  provided: string | null,
): Promise<boolean> {
  if (!provided) {
    return false;
  }
  const expected = await expectedSignature(body, secret);
  return timingSafeEqual(expected, provided);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const secret = requireEnv("CALLBACK_SECRET");
    const rawBody = await req.arrayBuffer();
    const signature = req.headers.get(SIGNATURE_HEADER);

    if (!(await verifySignature(rawBody, secret, signature))) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(
      new TextDecoder().decode(rawBody),
    ) as CallbackBody;

    const referenceId = payload.reference_id;
    if (!referenceId) {
      return Response.json({ error: "Missing reference_id" }, { status: 400 });
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    if (typeof payload.error === "string") {
      const { error: dbError } = await supabase
        .from("references")
        .update({
          status: "failed",
          error_message: payload.error,
        })
        .eq("id", referenceId);

      if (dbError) {
        return Response.json(
          { error: "Failed to update reference", detail: dbError.message },
          { status: 500 },
        );
      }

      return Response.json({ ok: true, status: "failed" });
    }

    if (!payload.keypoints || !payload.bounding_box) {
      return Response.json(
        { error: "Missing keypoints or bounding_box" },
        { status: 400 },
      );
    }

    const { error: dbError } = await supabase
      .from("references")
      .update({
        status: "ready",
        keypoints: payload.keypoints,
        bounding_box: payload.bounding_box,
        error_message: null,
      })
      .eq("id", referenceId);

    if (dbError) {
      return Response.json(
        { error: "Failed to update reference", detail: dbError.message },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
});
