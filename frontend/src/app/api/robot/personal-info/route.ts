import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const ROBOT_CORE_BASE =
  process.env.NEXT_PUBLIC_ROBOT_CORE_API_URL?.replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id") || "";
  const appV = url.searchParams.get("app_v") || "web-1.0.0";
  const platform = url.searchParams.get("platform") || "web";

  // Forward Authorization từ client (token lưu localStorage phía browser)
  const auth = request.headers.get("authorization") || "";

  if (!auth) {
    return NextResponse.json(
      { status: 401, message: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const upstream = new URL(`${ROBOT_CORE_BASE}/api/v1/personal/info`);
  upstream.searchParams.set("device_id", deviceId);
  upstream.searchParams.set("app_v", appV);
  upstream.searchParams.set("platform", platform);

  const res = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: auth,
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  return NextResponse.json(body, { status: res.status });
}
