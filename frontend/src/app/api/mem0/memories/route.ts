import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const MEM0_BASE =
  process.env.MEM0_BASE_URL?.trim() || "";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profile_id");

  if (!profileId) {
    return NextResponse.json(
      { error: "Missing required query param: profile_id" },
      { status: 400 }
    );
  }

  const upstream = new URL(`${MEM0_BASE}/memories`);
  upstream.searchParams.set("user_id", profileId);

  try {
    const res = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    console.error("[mem0 proxy] fetch failed:", e);
    return NextResponse.json(
      { error: "Failed to fetch mem0 memories" },
      { status: 502 }
    );
  }
}

