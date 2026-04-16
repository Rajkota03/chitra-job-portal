"use client";

import { useMemo, useState, useTransition } from "react";
import type { Job } from "@/lib/types";

type Tab = "new" | "followup" | "applied" | "seen" | "dismissed" | "all";
type Status = "new" | "seen" | "applied" | "dismissed";

const FOLLOWUP_AFTER_DAYS = 3;

export default function Dashboard({
  jobs: initialJobs,
  lastRun,
}: {
  jobs: Job[];
  lastRun: { ran_at: string; new_jobs: number; jobs_found: number; notified: number } | null;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [tab, setTab] = useState<Tab>("new");
  const [pending, startTransition] = useTransition();

  const needsFollowup = (j: Job) => {
    if (j.status !== "applied" || !j.applied_at) return false;
    if (j.followed_up_at) return false;
    const days = (Date.now() - new Date(j.applied_at).getTime()) / (1000 * 60 * 60 * 24);
    return days >= FOLLOWUP_AFTER_DAYS;
  };

  const counts = useMemo(() => ({
    new: jobs.filter(j => j.status === "new").length,
    followup: jobs.filter(needsFollowup).length,
    applied: jobs.filter(j => j.status === "applied").length,
    seen: jobs.filter(j => j.status === "seen").length,
    dismissed: jobs.filter(j => j.status === "dismissed").length,
    all: jobs.length,
  }), [jobs]);

  const visible =
    tab === "all" ? jobs :
    tab === "followup" ? jobs.filter(needsFollowup) :
    jobs.filter(j => j.status === tab);

  function updateStatus(id: string, status: Status) {
    const prev = jobs;
    const patch: Partial<Job> = { status };
    if (status === "applied" && !prev.find(j => j.id === id)?.applied_at) {
      patch.applied_at = new Date().toISOString();
    }
    setJobs(prev.map(j => j.id === id ? { ...j, ...patch } : j));
    startTransition(async () => {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) setJobs(prev);
    });
  }

  function markFollowedUp(id: string) {
    const prev = jobs;
    setJobs(prev.map(j => j.id === id ? { ...j, followed_up_at: new Date().toISOString() } : j));
    startTransition(async () => {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, followedUp: true }),
      });
      if (!res.ok) setJobs(prev);
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "new",       label: "New" },
    { key: "followup",  label: "Follow up" },
    { key: "applied",   label: "Applied" },
    { key: "seen",      label: "Seen" },
    { key: "dismissed", label: "Dismissed" },
    { key: "all",       label: "All" },
  ];

  return (
    <div className="wrap">
      <header className="hero">
        <div>
          <h1>Good morning, Chitra.</h1>
          <div className="sub">Risk, controls & fraud roles — from Adzuna, Workday, Amazon, and startup boards.</div>
        </div>
        <div className="meta">
          {lastRun ? (
            <>Last scan: {new Date(lastRun.ran_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {lastRun.new_jobs} new</>
          ) : "No scans yet"}
        </div>
      </header>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
            <span className={`count ${t.key === "followup" && counts.followup > 0 ? "urgent" : ""}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          {tab === "new" ? "No new roles right now. Next scan runs automatically." :
           tab === "followup" ? "Nothing to follow up on. Come back after you apply to a few roles." :
           `Nothing in ${tab}.`}
        </div>
      ) : visible.map(j => (
        <JobCard
          key={j.id}
          job={j}
          onUpdate={updateStatus}
          onFollowedUp={markFollowedUp}
          needsFollowup={needsFollowup(j)}
          disabled={pending}
        />
      ))}
    </div>
  );
}

function JobCard({ job, onUpdate, onFollowedUp, needsFollowup, disabled }: {
  job: Job;
  onUpdate: (id: string, s: Status) => void;
  onFollowedUp: (id: string) => void;
  needsFollowup: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hot = job.relevance_score >= 60;
  const hasDescription = job.description && job.description.trim().length > 0;
  const isApplied = job.status === "applied";

  const daysSinceApplied = job.applied_at
    ? Math.floor((Date.now() - new Date(job.applied_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`card ${open ? "open" : ""} ${needsFollowup ? "urgent" : ""}`}>
      <button
        type="button"
        className="card-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{job.title}</h3>
          <div className="co">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
            {job.posted_at ? ` · ${timeAgo(job.posted_at)}` : ""}
          </div>
          <div className="tags">
            {needsFollowup && <span className="tag hot">Follow up · {daysSinceApplied}d</span>}
            {hot && !needsFollowup && <span className="tag hot">Strong match</span>}
            {isApplied && daysSinceApplied !== null && !needsFollowup && (
              <span className="tag">applied {daysSinceApplied}d ago</span>
            )}
            {job.work_mode && job.work_mode !== "unknown" && <span className="tag">{job.work_mode}</span>}
            {job.salary && <span className="tag salary">{job.salary}</span>}
            <span className="tag">{job.source}</span>
          </div>
        </div>
        <span className="chev" aria-hidden>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          {hasDescription && <div className="desc">{cleanDescription(job.description!)}</div>}
          <div className="people">
            <div className="people-label">Shortcut your application:</div>
            <div className="people-links">
              <a className="link-pill" href={linkedinHiringManager(job)} target="_blank" rel="noreferrer">
                🎯 Find hiring manager
              </a>
              <a className="link-pill" href={linkedinRecruiter(job)} target="_blank" rel="noreferrer">
                📞 Find recruiter
              </a>
              <a className="link-pill" href={linkedinEmployees(job)} target="_blank" rel="noreferrer">
                👥 Find employees for referral
              </a>
            </div>
          </div>
        </>
      )}

      <div className="actions">
        <a className="btn" href={job.apply_url} target="_blank" rel="noreferrer"
           onClick={() => job.status === "new" && onUpdate(job.id, "seen")}>
          Apply →
        </a>
        <div className="ghost-row">
          {needsFollowup ? (
            <button className="btn ghost" disabled={disabled} onClick={() => onFollowedUp(job.id)}>
              ✓ Marked followed up
            </button>
          ) : !isApplied ? (
            <button className="btn ghost" disabled={disabled} onClick={() => onUpdate(job.id, "applied")}>
              Mark applied
            </button>
          ) : null}
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

// ---------- Helpers ----------

function linkedinHiringManager(job: Job): string {
  // Searches for people at the company whose title matches the role's department
  const dept = extractDept(job.title);
  const q = `"${dept}" "${job.company}" hyderabad`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&origin=GLOBAL_SEARCH_HEADER`;
}

function linkedinRecruiter(job: Job): string {
  const q = `recruiter OR "talent acquisition" "${job.company}" India`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&origin=GLOBAL_SEARCH_HEADER`;
}

function linkedinEmployees(job: Job): string {
  const dept = extractDept(job.title);
  const q = `"${job.company}" "${dept}" hyderabad`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&origin=GLOBAL_SEARCH_HEADER`;
}

function extractDept(title: string): string {
  const t = title.toLowerCase();
  if (/fraud/.test(t)) return "fraud";
  if (/aml|financial crime|money laundering/.test(t)) return "financial crime";
  if (/audit/.test(t)) return "internal audit";
  if (/sox/.test(t)) return "SOX";
  if (/compliance/.test(t)) return "compliance";
  if (/control/.test(t)) return "risk controls";
  if (/risk/.test(t)) return "operational risk";
  return "risk";
}

function cleanDescription(s: string): string {
  return s
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
