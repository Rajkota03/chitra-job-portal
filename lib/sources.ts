import { createHash } from "crypto";
import type { RawJob } from "./types";
import { SEARCH_QUERIES } from "./matcher";

function hashId(source: string, sourceId: string): string {
  return createHash("sha1").update(`${source}:${sourceId}`).digest("hex").slice(0, 24);
}

function detectWorkMode(text: string): RawJob["work_mode"] {
  const t = text.toLowerCase();
  if (/\bremote\b|work from home|wfh/.test(t)) return "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bon-?site\b|in-?office/.test(t)) return "onsite";
  return "unknown";
}

// ---------- Adzuna (India) ----------
// Free tier: 250 calls/mo, 50 results per call. Keep query count modest.
async function fetchAdzuna(): Promise<RawJob[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];

  const out: RawJob[] = [];
  for (const q of SEARCH_QUERIES) {
    const url = new URL("https://api.adzuna.com/v1/api/jobs/in/search/1");
    url.searchParams.set("app_id", id);
    url.searchParams.set("app_key", key);
    url.searchParams.set("results_per_page", "25");
    url.searchParams.set("what", q);
    url.searchParams.set("where", "Hyderabad");
    url.searchParams.set("max_days_old", "14");
    url.searchParams.set("sort_by", "date");

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.results ?? []) {
        const text = `${r.title ?? ""} ${r.description ?? ""}`;
        out.push({
          source: "adzuna",
          source_id: String(r.id),
          title: r.title ?? "",
          company: r.company?.display_name ?? "Unknown",
          location: r.location?.display_name ?? null,
          work_mode: detectWorkMode(text),
          salary: r.salary_min && r.salary_max
            ? `₹${Math.round(r.salary_min).toLocaleString()}–₹${Math.round(r.salary_max).toLocaleString()}`
            : null,
          description: (r.description ?? "").slice(0, 1000),
          apply_url: r.redirect_url,
          posted_at: r.created ?? null,
        });
      }
    } catch {
      // Skip this query on error
    }
  }
  return out;
}

// ---------- Greenhouse boards ----------
// Add company board tokens (from boards.greenhouse.io/<token>) that commonly hire
// risk/audit/fraud roles in India.
const GREENHOUSE_BOARDS = [
  "stripe", "airbnb", "doordash", "coinbase", "chime",
  "affirm", "robinhood", "plaid", "brex", "ramp",
  "wise", "remitly",
];

async function fetchGreenhouse(): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (const token of GREENHOUSE_BOARDS) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs ?? []) {
        const loc = j.location?.name ?? "";
        const title = j.title ?? "";
        // Pre-filter: must be India-ish OR remote AND risk/audit/fraud-shaped
        const locOk = /india|hyderabad|bangalore|bengaluru|mumbai|remote|gurgaon|gurugram|pune|delhi/i.test(loc);
        const titleOk = /risk|audit|fraud|compliance|control|aml|kyc|financial crime/i.test(title);
        if (!locOk || !titleOk) continue;
        out.push({
          source: "greenhouse",
          source_id: String(j.id),
          title,
          company: token.charAt(0).toUpperCase() + token.slice(1),
          location: loc || null,
          work_mode: detectWorkMode(`${title} ${loc} ${j.content ?? ""}`),
          salary: null,
          description: stripHtml(j.content ?? "").slice(0, 1000),
          apply_url: j.absolute_url,
          posted_at: j.updated_at ?? null,
        });
      }
    } catch {
      // skip
    }
  }
  return out;
}

// ---------- Lever boards ----------
const LEVER_COMPANIES = ["razorpay", "cred", "zeta", "upstox", "groww", "khatabook"];

async function fetchLever(): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (const co of LEVER_COMPANIES) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${co}?mode=json`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data ?? []) {
        const loc = j.categories?.location ?? "";
        const title = j.text ?? "";
        const locOk = /india|hyderabad|bangalore|bengaluru|mumbai|remote|gurgaon|gurugram|pune|delhi/i.test(loc);
        const titleOk = /risk|audit|fraud|compliance|control|aml|kyc|financial crime/i.test(title);
        if (!locOk || !titleOk) continue;
        out.push({
          source: "lever",
          source_id: String(j.id),
          title,
          company: co.charAt(0).toUpperCase() + co.slice(1),
          location: loc || null,
          work_mode: j.categories?.commitment?.toLowerCase().includes("remote") ? "remote" : detectWorkMode(`${title} ${loc}`),
          salary: null,
          description: stripHtml(j.descriptionPlain ?? j.description ?? "").slice(0, 1000),
          apply_url: j.hostedUrl,
          posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        });
      }
    } catch {
      // skip
    }
  }
  return out;
}

function stripHtml(s: string): string {
  return s
    // Decode encoded angle brackets & quotes (Greenhouse double-encodes)
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    // Strip actual tags
    .replace(/<[^>]*>/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Workday (generic, tenant-configured) ----------
// Each company has a Career Experience Service (CXS) endpoint. Verified live as of build:
const WORKDAY_TENANTS = [
  { name: "Wells Fargo",    cxs: "https://wd1.myworkdaysite.com/wday/cxs/wf/WellsFargoJobs/jobs",              apply: "https://wd1.myworkdaysite.com/en-US/recruiting/wf/WellsFargoJobs" },
  { name: "PwC",            cxs: "https://pwc.wd3.myworkdayjobs.com/wday/cxs/pwc/Global_Experienced_Careers/jobs", apply: "https://pwc.wd3.myworkdayjobs.com/en-US/Global_Experienced_Careers" },
  { name: "Citi",           cxs: "https://citi.wd5.myworkdayjobs.com/wday/cxs/citi/2/jobs",                    apply: "https://citi.wd5.myworkdayjobs.com/en-US/2" },
  { name: "Accenture",      cxs: "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs", apply: "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers" },
  { name: "Salesforce",     cxs: "https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs", apply: "https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site" },
  { name: "Morgan Stanley", cxs: "https://ms.wd5.myworkdayjobs.com/wday/cxs/ms/External/jobs",                 apply: "https://ms.wd5.myworkdayjobs.com/en-US/External" },
];

type WorkdayTenant = typeof WORKDAY_TENANTS[number];

async function fetchWorkdayTenant(t: WorkdayTenant): Promise<RawJob[]> {
  type Pending = { job: RawJob; externalPath: string };
  const pending: Pending[] = [];
  const seenPaths = new Set<string>();

  // Fan queries out in parallel — Workday CXS handles concurrent requests fine.
  const searchResults = await Promise.allSettled(
    ["fraud", "risk", "audit", "compliance"].map(q =>
      fetch(t.cxs, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }),
        cache: "no-store",
      }).then(r => (r.ok ? r.json() : null))
    )
  );

  for (const r of searchResults) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const j of r.value.jobPostings ?? []) {
      const title = j.title ?? "";
      const loc = j.locationsText ?? "";
      const externalPath = j.externalPath ?? "";
      const locOk = /hyderabad|bangalore|bengaluru|mumbai|pune|gurgaon|gurugram|delhi|noida|chennai|india/i.test(loc);
      const titleOk = /risk|audit|fraud|compliance|control|aml|kyc|financial crime|accountability|sox/i.test(title);
      if (!locOk || !titleOk) continue;
      if (externalPath && seenPaths.has(externalPath)) continue;
      if (externalPath) seenPaths.add(externalPath);
      pending.push({
        externalPath,
        job: {
          source: "workday",
          source_id: `${t.name}:${externalPath || title}`,
          title,
          company: t.name,
          location: loc || null,
          work_mode: detectWorkMode(`${title} ${loc}`),
          salary: null,
          description: null,
          apply_url: `${t.apply}${externalPath}`,
          posted_at: parseWorkdayPostedOn(j.postedOn),
        },
      });
    }
  }

  // externalPath already starts with "/job/...", so just append to the tenant root.
  const detailBase = t.cxs.replace(/\/jobs$/, "");
  return Promise.all(
    pending.map(async p => {
      if (!p.externalPath) return p.job;
      const desc = await fetchWorkdayDetail(`${detailBase}${p.externalPath}`);
      return desc
        ? { ...p.job, description: desc, work_mode: detectWorkMode(`${p.job.title} ${p.job.location ?? ""} ${desc}`) }
        : p.job;
    })
  );
}

async function fetchWorkday(): Promise<RawJob[]> {
  // Run all tenants in parallel — cuts wall time from ~(tenants × queries × rtt) to max(tenant).
  const results = await Promise.allSettled(WORKDAY_TENANTS.map(fetchWorkdayTenant));
  const out: RawJob[] = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  return out;
}

// Given rows like { id, source_id: "WellsFargo:/job/..." }, fetch each description
// in parallel and return {id, description} for the ones that resolved.
// Used by the cron to heal older rows that were inserted before descriptions were fetched.
export async function backfillWorkdayDescriptions(
  rows: { id: string; source_id: string }[]
): Promise<{ id: string; description: string }[]> {
  const tenantsByName = new Map(WORKDAY_TENANTS.map(t => [t.name, t]));
  const results = await Promise.all(
    rows.map(async r => {
      const sep = r.source_id.indexOf(":");
      if (sep === -1) return null;
      const tenantName = r.source_id.slice(0, sep);
      const externalPath = r.source_id.slice(sep + 1);
      const t = tenantsByName.get(tenantName);
      if (!t || !externalPath.startsWith("/job/")) return null;
      const detailBase = t.cxs.replace(/\/jobs$/, "");
      const desc = await fetchWorkdayDetail(`${detailBase}${externalPath}`);
      return desc ? { id: r.id, description: desc } : null;
    })
  );
  return results.filter((x): x is { id: string; description: string } => x !== null);
}

async function fetchWorkdayDetail(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const html: string = data?.jobPostingInfo?.jobDescription ?? "";
    if (!html) return null;
    return stripHtml(html).slice(0, 2000);
  } catch {
    return null;
  }
}

function parseWorkdayPostedOn(s: string | undefined): string | null {
  // Workday returns strings like "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago"
  if (!s) return null;
  const now = Date.now();
  if (/yesterday/i.test(s)) return new Date(now - 86400_000).toISOString();
  if (/today/i.test(s)) return new Date(now).toISOString();
  const m = s.match(/(\d+)\+?\s*days?/i);
  if (m) return new Date(now - parseInt(m[1]) * 86400_000).toISOString();
  return null;
}

// ---------- Amazon.jobs (proprietary public search API) ----------
async function fetchAmazon(): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (const q of ["fraud", "risk control", "audit", "compliance"]) {
    try {
      const url = `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(q)}&loc_query=Hyderabad%2C%20India&result_limit=25&sort=recent`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs ?? []) {
        const title = j.title ?? "";
        const titleOk = /risk|audit|fraud|compliance|control|investigator|aml|kyc|financial crime|sox/i.test(title);
        if (!titleOk) continue;
        out.push({
          source: "amazon",
          source_id: String(j.id_icims ?? j.id ?? j.job_path ?? title),
          title,
          company: "Amazon",
          location: [j.city, j.country].filter(Boolean).join(", ") || null,
          work_mode: "unknown",
          salary: null,
          description: (j.description_short ?? j.basic_qualifications ?? "").slice(0, 1000) || null,
          apply_url: `https://www.amazon.jobs${j.job_path ?? ""}`,
          posted_at: j.posted_date ? new Date(j.posted_date).toISOString() : null,
        });
      }
    } catch {
      // skip
    }
  }
  return out;
}

export async function fetchAllJobs(): Promise<{ jobs: (RawJob & { id: string })[]; sourcesHit: number }> {
  const results = await Promise.allSettled([fetchAdzuna(), fetchGreenhouse(), fetchLever(), fetchWorkday(), fetchAmazon()]);
  const raw: RawJob[] = [];
  let hit = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      raw.push(...r.value);
      if (r.value.length > 0) hit++;
    }
  }
  // Dedupe by source+id, then again by company+title (Adzuna re-posts same role under different IDs)
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const jobs: (RawJob & { id: string })[] = [];
  for (const r of raw) {
    const id = hashId(r.source, r.source_id);
    if (seenIds.has(id)) continue;
    const titleKey = `${r.company.toLowerCase().trim()}::${r.title.toLowerCase().trim()}`;
    if (seenTitles.has(titleKey)) continue;
    seenIds.add(id);
    seenTitles.add(titleKey);
    jobs.push({ ...r, id });
  }
  return { jobs, sourcesHit: hit };
}
