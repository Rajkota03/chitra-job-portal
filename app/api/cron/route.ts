import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";
import { fetchAllJobs } from "@/lib/sources";
import { scoreJob } from "@/lib/matcher";
import { sendDigest } from "@/lib/email";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hit this URL from cron-job.org twice daily with header:
//   Authorization: Bearer $CRON_SECRET
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = adminClient();
  const log = { sources_hit: 0, jobs_found: 0, new_jobs: 0, notified: 0, error: null as string | null };

  try {
    const { jobs, sourcesHit } = await fetchAllJobs();
    log.sources_hit = sourcesHit;
    log.jobs_found = jobs.length;

    if (jobs.length === 0) {
      await sb.from("cron_runs").insert(log);
      return NextResponse.json({ ok: true, ...log });
    }

    // Score + upsert. onConflict=id means existing jobs keep their status/notified.
    const rows = jobs.map(j => ({
      ...j,
      relevance_score: scoreJob(j.title, j.description, j.location),
    })).filter(j => j.relevance_score >= 25); // quality gate

    // Find which of these are truly new (not already in DB) so we only email those
    const ids = rows.map(r => r.id);
    const { data: existing } = await sb.from("jobs").select("id").in("id", ids);
    const existingIds = new Set((existing ?? []).map(r => r.id));
    const newOnes = rows.filter(r => !existingIds.has(r.id));
    log.new_jobs = newOnes.length;

    // Insert only new rows (don't touch existing; they may have status changes)
    if (newOnes.length > 0) {
      const { error } = await sb.from("jobs").insert(newOnes);
      if (error) throw new Error(error.message);
    }

    // Email digest of new high-match jobs
    const toNotify = newOnes
      .filter(j => j.relevance_score >= 30)
      .slice(0, 25) as unknown as Job[];

    if (toNotify.length > 0) {
      const { sent } = await sendDigest(toNotify);
      if (sent) {
        log.notified = toNotify.length;
        await sb.from("jobs").update({ notified: true }).in("id", toNotify.map(j => j.id));
      }
    }

    await sb.from("cron_runs").insert(log);
    return NextResponse.json({ ok: true, ...log });
  } catch (e: unknown) {
    log.error = e instanceof Error ? e.message : String(e);
    await sb.from("cron_runs").insert(log);
    return NextResponse.json({ ok: false, ...log }, { status: 500 });
  }
}
