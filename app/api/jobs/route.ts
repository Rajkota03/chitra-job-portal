import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "new";
  const sb = adminClient();
  const { data, error } = await sb
    .from("jobs")
    .select("*")
    .eq("status", status === "all" ? "status" : status) // "all" will match nothing; handled below
    .order("relevance_score", { ascending: false })
    .order("found_at", { ascending: false })
    .limit(200);

  if (status === "all") {
    const { data: all, error: e2 } = await sb
      .from("jobs").select("*")
      .order("relevance_score", { ascending: false })
      .order("found_at", { ascending: false })
      .limit(200);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json({ jobs: all });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json();
  if (!id || !["new", "seen", "applied", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const sb = adminClient();
  const { error } = await sb.from("jobs").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
