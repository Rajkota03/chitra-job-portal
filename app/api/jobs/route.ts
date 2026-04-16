import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "new";
  const sb = adminClient();

  const q = sb.from("jobs")
    .select("*")
    .order("relevance_score", { ascending: false })
    .order("found_at", { ascending: false })
    .limit(300);

  const { data, error } = status === "all" ? await q : await q.eq("status", status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}

export async function PATCH(req: Request) {
  const { id, status, followedUp } = await req.json();

  const sb = adminClient();
  const patch: Record<string, unknown> = {};

  if (status) {
    if (!["new", "seen", "applied", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }
    patch.status = status;
    // First time marking applied → stamp applied_at. Don't overwrite if already set.
    if (status === "applied") {
      const { data: existing } = await sb.from("jobs").select("applied_at").eq("id", id).single();
      if (!existing?.applied_at) patch.applied_at = new Date().toISOString();
    }
  }

  if (followedUp === true) {
    patch.followed_up_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await sb.from("jobs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
