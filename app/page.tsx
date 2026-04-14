import { adminClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const pw = formData.get("password");
  if (pw === process.env.DASHBOARD_PASSWORD) {
    (await cookies()).set("auth", process.env.DASHBOARD_PASSWORD!, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/");
  }
  redirect("/?err=1");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const params = await searchParams;
  const authed = (await cookies()).get("auth")?.value === process.env.DASHBOARD_PASSWORD;

  if (!authed) {
    return (
      <div className="wrap">
        <form action={login} className="gate">
          <h2>Chitra · Job Portal</h2>
          <p>Enter the password to continue.</p>
          <input name="password" type="password" placeholder="Password" autoFocus />
          <button type="submit">Unlock</button>
          {params.err && <p style={{ color: "#b91c1c", marginTop: 10, fontSize: 12 }}>Wrong password.</p>}
        </form>
      </div>
    );
  }

  const sb = adminClient();
  const [{ data: jobs }, { data: runs }] = await Promise.all([
    sb.from("jobs").select("*").order("relevance_score", { ascending: false }).order("found_at", { ascending: false }).limit(300),
    sb.from("cron_runs").select("*").order("ran_at", { ascending: false }).limit(1),
  ]);

  const lastRun = runs?.[0];
  return <Dashboard jobs={(jobs ?? []) as Job[]} lastRun={lastRun ?? null} />;
}
