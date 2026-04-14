"use client";

import { useMemo, useState, useTransition } from "react";
import type { Job } from "@/lib/types";

type Status = "new" | "seen" | "applied" | "dismissed" | "all";

export default function Dashboard({
  jobs: initialJobs,
  lastRun,
}: {
  jobs: Job[];
  lastRun: { ran_at: string; new_jobs: number; jobs_found: number; notified: number } | null;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [tab, setTab] = useState<Status>("new");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => ({
    new: jobs.filter(j => j.status === "new").length,
    seen: jobs.filter(j => j.status === "seen").length,
    applied: jobs.filter(j => j.status === "applied").length,
    dismissed: jobs.filter(j => j.status === "dismissed").length,
    all: jobs.length,
  }), [jobs]);

  const visible = tab === "all" ? jobs : jobs.filter(j => j.status === tab);

  function updateStatus(id: string, status: Exclude<Status, "all">) {
    const prev = jobs;
    setJobs(prev.map(j => j.id === id ? { ...j, status } : j));
    startTransition(async () => {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) setJobs(prev); // rollback
    });
  }

  return (
    <div className="wrap">
      <header className="hero">
        <div>
          <h1>Good morning, Chitra.</h1>
          <div className="sub">Risk, controls & fraud roles — curated from Adzuna, Greenhouse, and Lever boards.</div>
        </div>
        <div className="meta">
          {lastRun ? (
            <>Last scan: {new Date(lastRun.ran_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {lastRun.new_jobs} new</>
          ) : "No scans yet"}
        </div>
      </header>

      <div className="tabs">
        {(["new", "applied", "seen", "dismissed", "all"] as const).map(s => (
          <button key={s} className={tab === s ? "active" : ""} onClick={() => setTab(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            <span className="count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          {tab === "new" ? "No new roles right now. Next scan runs automatically." : `Nothing in ${tab}.`}
        </div>
      ) : visible.map(j => <JobCard key={j.id} job={j} onUpdate={updateStatus} disabled={pending} />)}
    </div>
  );
}

function JobCard({ job, onUpdate, disabled }: {
  job: Job;
  onUpdate: (id: string, s: "new" | "seen" | "applied" | "dismissed") => void;
  disabled: boolean;
}) {
  const hot = job.relevance_score >= 60;
  return (
    <div className="card">
      <div className="top">
        <div style={{ flex: 1 }}>
          <h3>{job.title}</h3>
          <div className="co">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
            {job.posted_at ? ` · ${timeAgo(job.posted_at)}` : ""}
          </div>
          <div className="tags">
            {hot && <span className="tag hot">Strong match</span>}
            {job.work_mode && job.work_mode !== "unknown" && <span className="tag">{job.work_mode}</span>}
            {job.salary && <span className="tag salary">{job.salary}</span>}
            <span className="tag">{job.source}</span>
          </div>
        </div>
      </div>
      <div className="actions">
        <a className="btn" href={job.apply_url} target="_blank" rel="noreferrer"
           onClick={() => job.status === "new" && onUpdate(job.id, "seen")}>
          Apply →
        </a>
        <div className="ghost-row">
          {job.status !== "applied" && (
            <button className="btn ghost" disabled={disabled} onClick={() => onUpdate(job.id, "applied")}>
              Mark applied
            </button>
          )}
          {job.status !== "dismissed" && (
            <button className="btn ghost" disabled={disabled} onClick={() => onUpdate(job.id, "dismissed")}>
              Dismiss
            </button>
          )}
        </div>
        <span className="score">match {job.relevance_score}</span>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
