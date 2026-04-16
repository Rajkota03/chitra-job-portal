import { Resend } from "resend";
import type { Job } from "./types";

export async function sendDigest(
  newJobs: Job[],
  followUps: Job[] = []
): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (newJobs.length === 0 && followUps.length === 0) return { sent: false };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;
  if (!key || !from || !to) return { sent: false, error: "missing env" };

  const resend = new Resend(key);
  const html = renderDigest(newJobs, followUps);

  const parts: string[] = [];
  if (newJobs.length > 0) parts.push(`${newJobs.length} new match${newJobs.length === 1 ? "" : "es"}`);
  if (followUps.length > 0) parts.push(`${followUps.length} to follow up`);
  const subject = `${parts.join(" · ")} — Chitra`;

  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { sent: false, error: error.message };
    return { sent: true, id: data?.id };
  } catch (e: unknown) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function renderDigest(newJobs: Job[], followUps: Job[]): string {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? "#";
  const sections: string[] = [];

  if (followUps.length > 0) {
    sections.push(`
      <h3 style="margin:0 0 10px;color:#991b1b;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">⏰ Time to follow up (${followUps.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        ${followUps.map(followUpRow).join("")}
      </table>
    `);
  }

  if (newJobs.length > 0) {
    sections.push(`
      <h3 style="margin:0 0 10px;color:#111;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">✨ New matches (${newJobs.length})</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${[...newJobs].sort((a, b) => b.relevance_score - a.relevance_score).map(jobRow).join("")}
      </table>
    `);
  }

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1c1917;">
    <div style="color:#666;font-size:13px;margin-bottom:20px;">
      ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
    </div>
    ${sections.join("")}
    <div style="margin-top:24px;text-align:center;">
      <a href="${portalUrl}" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;">Open portal →</a>
    </div>
    <div style="color:#aaa;font-size:11px;margin-top:18px;text-align:center;">Sources: Adzuna · Workday (Wells Fargo, PwC, Citi, Accenture, Morgan Stanley, Salesforce) · Amazon.jobs · Greenhouse · Lever</div>
  </div>`;
}

function jobRow(j: Job): string {
  return `
    <tr>
      <td style="padding:14px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;font-size:15px;">${escape(j.title)}</div>
        <div style="color:#555;font-size:13px;margin-top:2px;">${escape(j.company)} · ${escape(j.location ?? "—")}${j.work_mode && j.work_mode !== "unknown" ? ` · ${j.work_mode}` : ""}</div>
        ${j.salary ? `<div style="color:#0a7;font-size:12px;margin-top:2px;">${escape(j.salary)}</div>` : ""}
        <div style="margin-top:8px;">
          <a href="${j.apply_url}" style="display:inline-block;background:#111;color:#fff;padding:6px 12px;border-radius:6px;font-size:13px;text-decoration:none;">Apply →</a>
          <span style="color:#888;font-size:12px;margin-left:10px;">match ${j.relevance_score}</span>
        </div>
      </td>
    </tr>`;
}

function followUpRow(j: Job): string {
  const days = j.applied_at
    ? Math.floor((Date.now() - new Date(j.applied_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? "#";
  return `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #fee;background:#fffbfa;">
        <div style="font-weight:600;font-size:14px;">${escape(j.title)}</div>
        <div style="color:#555;font-size:13px;margin-top:2px;">${escape(j.company)} · applied ${days} days ago</div>
        <div style="color:#991b1b;font-size:12px;margin-top:4px;">Ping the recruiter or hiring manager. Silence = they moved on.</div>
        <div style="margin-top:8px;">
          <a href="${portalUrl}" style="color:#0366d6;font-size:12px;">Open in portal →</a>
        </div>
      </td>
    </tr>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
