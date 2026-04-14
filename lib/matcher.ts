// Relevance scoring tuned to Chitra's profile:
// Risk & Controls / Fraud Investigation / Internal Audit / RCSA / SOX
// 8+ yrs, senior IC, Hyderabad.

const HIGH = [
  "control testing", "control management", "business accountability",
  "fraud investigation", "fraud investigator", "fraud ops", "fraud analyst",
  "rcsa", "risk and control", "risk & control", "operational risk",
  "internal audit", "sox", "customer remediation", "regulatory remediation",
];

const MEDIUM = [
  "risk analyst", "risk manager", "compliance analyst", "compliance officer",
  "audit analyst", "audit associate", "aml", "kyc",
  "financial crime", "transaction monitoring", "controls assurance",
  "quality assurance risk", "qa risk",
];

const LOW = [
  "risk", "audit", "compliance", "banking operations",
  "investigation", "fraud", "governance",
];

const SENIORITY_BONUS = [
  "senior", "sr.", "sr ", "lead", "principal", "specialist", "manager",
];

const DISQUALIFIERS = [
  "intern", "graduate trainee", "apprentice",
  "software engineer", "developer", "data scientist",
  "devops", "frontend", "backend", "ios", "android",
];

function countHits(haystack: string, needles: string[]): number {
  let n = 0;
  for (const k of needles) if (haystack.includes(k)) n++;
  return n;
}

export function scoreJob(title: string, description: string | null, location: string | null): number {
  const t = title.toLowerCase();
  const d = (description ?? "").toLowerCase();
  const loc = (location ?? "").toLowerCase();
  const hay = `${t} ${d}`;

  // Hard filters
  for (const k of DISQUALIFIERS) {
    if (t.includes(k)) return 0;
  }

  let score = 0;
  score += Math.min(countHits(hay, HIGH), 3) * 25;    // up to 75
  score += Math.min(countHits(hay, MEDIUM), 3) * 10;  // up to 30
  score += Math.min(countHits(hay, LOW), 3) * 3;      // up to 9

  // Title weight — hits in title count double
  score += Math.min(countHits(t, HIGH), 2) * 10;

  // Seniority match (she's senior, filter out junior noise)
  if (SENIORITY_BONUS.some(k => t.includes(k))) score += 8;

  // Hyderabad location bonus
  if (loc.includes("hyderabad") || loc.includes("hyd")) score += 10;
  else if (loc.includes("remote") || loc.includes("anywhere")) score += 5;
  else if (loc.includes("india")) score += 3;

  return Math.min(score, 100);
}

// Keywords we'll push to job sources as search queries
export const SEARCH_QUERIES = [
  "fraud investigator",
  "control testing",
  "internal audit",
  "risk analyst",
  "operational risk",
  "compliance analyst",
  "business accountability",
  "rcsa",
  "financial crime",
];
