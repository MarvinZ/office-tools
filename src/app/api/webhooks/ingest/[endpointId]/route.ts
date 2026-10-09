import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getWebhookEndpointById, recordWebhookEvent } from "@/services/webhooks/webhooks";

function verifySignature(rawBody: string, secret: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ endpointId: string }> }) {
  const { endpointId } = await params;
  const endpoint = await getWebhookEndpointById(endpointId);

  if (!endpoint || !endpoint.isActive) {
    return NextResponse.json({ error: "Unknown endpoint" }, { status: 404 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");
  const signatureValid = verifySignature(rawBody, endpoint.signingSecret, signature);

  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = null;
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  await recordWebhookEvent({
    tenantId: endpoint.tenantId,
    endpointId: endpoint.id,
    headers,
    body,
    rawBody,
    sourceIp: req.headers.get("x-forwarded-for"),
    signatureValid,
  });

  return NextResponse.json({ received: true, signatureValid });
}
