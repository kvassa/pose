import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SIGNED_URL_TTL_S = 3600;

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: { id?: string };
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as WebhookPayload;
    const referenceId = body.record?.id;
    if (!referenceId) {
      return Response.json({ error: "Missing record.id in webhook payload" }, {
        status: 400,
      });
    }

    const workerUrl = requireEnv("POSE_WORKER_URL").replace(/\/$/, "");
    const callbackUrl = requireEnv("POSE_WORKER_CALLBACK_URL");

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: reference, error: rowError } = await supabase
      .from("references")
      .select("id, image_path")
      .eq("id", referenceId)
      .single();

    if (rowError || !reference) {
      return Response.json(
        { error: "Reference not found", detail: rowError?.message },
        { status: 404 },
      );
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("reference-images")
      .createSignedUrl(reference.image_path, SIGNED_URL_TTL_S);

    if (signError || !signed?.signedUrl) {
      return Response.json(
        { error: "Failed to create signed URL", detail: signError?.message },
        { status: 500 },
      );
    }

    const workerResponse = await fetch(`${workerUrl}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_id: referenceId,
        signed_image_url: signed.signedUrl,
        callback_url: callbackUrl,
      }),
    });

    if (workerResponse.status !== 202) {
      const detail = await workerResponse.text();
      return Response.json(
        {
          error: "Worker rejected extract request",
          status: workerResponse.status,
          detail,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      reference_id: referenceId,
      worker_status: 202,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
});
