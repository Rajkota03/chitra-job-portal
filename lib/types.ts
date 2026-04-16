export type Job = {
  id: string;
  source: "adzuna" | "greenhouse" | "lever" | "workday" | "amazon";
  source_id: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: "remote" | "hybrid" | "onsite" | "unknown" | null;
  salary: string | null;
  description: string | null;
  apply_url: string;
  posted_at: string | null;
  found_at?: string;
  applied_at?: string | null;
  followed_up_at?: string | null;
  relevance_score: number;
  status: "new" | "seen" | "applied" | "dismissed";
  notified: boolean;
};

export type RawJob = Omit<Job, "id" | "relevance_score" | "status" | "notified" | "found_at" | "applied_at" | "followed_up_at">;
