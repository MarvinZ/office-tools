import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
  const { blobs } = await list({ prefix: "uploads/" });

  const files = blobs.map((b) => ({
    url: b.url,
    name: b.pathname.replace("uploads/", ""),
    uploadedAt: b.uploadedAt,
  }));

  return NextResponse.json(files);
}
