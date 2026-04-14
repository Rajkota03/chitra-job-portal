import { Resend } from "resend";
import type { Job } from "./types";

export async function sendDigest(jobs: Job[]): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (jobs.length === 0) return { sent: false };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;
  if (!key || !from || !to) return { sent: false, error: "missing env" };

  const resend = new Resend(key);
  const html = renderDigest(jobs);
  const subject = `${jobs.length} new role${jobs.length === 1 ? "" : "s"} matched today — Chitra`;

  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { sent: false, error: error.message };
    return { sent: true, id: data?.id };
  } catch (e: unknown) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function renderDigest(jobs: Job[]): string {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? "#";
  const rows = jobs
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .map(j => `
      <tr>
        <td style="padding:14px 12px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;font-size:15px;color:#111;">${escape(j.title)}</div>
          <div style="color:#555;font-size:13px;margin-top:2px;">${escape(j.company)} · ${escape(j.location ?? "—")}${j.work_mode && j.work_mode !== "unknown" ? ` · ${j.work_mode}` : ""}</div>
          ${j.salary ? `<div style="color:#0a7;font-size:12px;margin-top:2px;">${escape(j.salary)}</div>` : ""}
          <div style="margin-top:8px;">
            <a href="${j.apply_url}" style="display:inline-block;background:#111;color:#fff;padding:6px 12px;border-radius:6px;font-size:13px;text-decoration:none;">Apply →</a>
            <span style="color:#888;font-size:12px;margin-left:10px;">match: ${j.relevance_score}</span>
          </div>
        </td>
      </tr>`).join("");

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 4px;color:#111;">${jobs.length} new match${jobs.length === 1 ? "" : "es"}</h2>
    <div style="color:#666;font-size:13px;margin-bottom:20px;">Ranked by fit with your background · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${portalUrl}" style="color:#0366d6;font-size:13px;">Open full portal →</a>
    </div>
    <div style="color:#aaa;font-size:11px;margin-top:18px;text-align:center;">Scanned Adzuna, Greenhouse boards, and Lever boards.</div>
  </div>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
