import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

// Dev-only scaffolding: lists every blob under uploads/ with no tenant filter,
// so it must never be reachable in production.
export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const { blobs } = await list({ prefix: "uploads/" });

  const files = blobs.map((b) => ({
    url: b.url,
    name: b.pathname.replace("uploads/", ""),
    uploadedAt: b.uploadedAt,
  }));

  return NextResponse.json(files);
}
