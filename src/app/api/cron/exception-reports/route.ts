import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";
import { getExceptionReportAlert, type ExceptionReportStage } from "@/lib/exceptionReportTiming";

/**
 * Daily cron (vercel.json) that emails each account owner a digest of
 * manifests newly past day 45 / day 60 with no signed facility copy.
 * Needs three env vars; without them it reports 503 and does nothing:
 *   CRON_SECRET (Vercel sends it as a Bearer token on cron calls),
 *   SUPABASE_SERVICE_ROLE_KEY, plus the existing Resend and Supabase vars.
 * Each manifest is emailed at most once per stage (exception_report_reminders).
 */
export const dynamic = "force-dynamic";

type Row = {
  epa_mtn: string;
  user_id: string;
  epa_status: string | null;
  generator_name: string | null;
  generator_signed_at: string | null;
  transporter_signed_at: string | null;
  facility_signed_at: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Candidates: transporter signed, no facility signature, older than 45 days.
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("manifests")
    .select("epa_mtn, user_id, epa_status, generator_name, generator_signed_at, transporter_signed_at, facility_signed_at")
    .is("facility_signed_at", null)
    .not("transporter_signed_at", "is", null)
    .lte("generator_signed_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due: { row: Row; stage: ExceptionReportStage; days: number }[] = [];
  for (const row of (data ?? []) as Row[]) {
    const alert = getExceptionReportAlert(
      row.generator_signed_at, row.transporter_signed_at, row.facility_signed_at, row.epa_status
    );
    if (alert) due.push({ row, stage: alert.stage, days: alert.daysElapsed });
  }
  if (due.length === 0) return NextResponse.json({ candidates: 0, emailed: 0 });

  const { data: sentRows } = await db
    .from("exception_report_reminders")
    .select("epa_mtn, stage")
    .in("epa_mtn", due.map((d) => d.row.epa_mtn));
  const sent = new Set((sentRows ?? []).map((r) => `${r.epa_mtn}:${r.stage}`));
  const fresh = due.filter((d) => !sent.has(`${d.row.epa_mtn}:${d.stage}`));

  const byUser = new Map<string, typeof fresh>();
  for (const d of fresh) byUser.set(d.row.user_id, [...(byUser.get(d.row.user_id) ?? []), d]);

  const { data: optouts } = await db
    .from("exception_report_email_optout")
    .select("user_id")
    .in("user_id", [...byUser.keys()]);
  const optedOut = new Set((optouts ?? []).map((o) => o.user_id));

  const base = "https://hazwastemanifestmate.com";
  let emailed = 0;
  let failed = 0;
  for (const [userId, items] of byUser) {
    if (optedOut.has(userId)) continue;
    const { data: u } = await db.auth.admin.getUserById(userId);
    const to = u?.user?.email;
    if (!to) continue;

    const file = items.filter((i) => i.stage === "file");
    const search = items.filter((i) => i.stage === "search");
    const line = (i: (typeof items)[number]) =>
      `  ${i.row.epa_mtn}${i.row.generator_name ? ` (${i.row.generator_name})` : ""}: ${i.days} days`;
    const parts: string[] = [];
    if (file.length)
      parts.push(
        `EXCEPTION REPORT DUE (60+ days, no signed facility copy):\n${file.map(line).join("\n")}\n\nSmall and large quantity generators file an Exception Report electronically in e-Manifest (Certifier role, no fee). Very small quantity generators are not required to file.`
      );
    if (search.length)
      parts.push(
        `FIND THE SIGNED COPY (45+ days, Exception Report due at 60):\n${search.map(line).join("\n")}\n\nContact the transporter and the receiving facility now to get the signed copy.`
      );
    const body = `${parts.join("\n\n")}\n\nThis list comes from ManifestMate's copy of your manifests and can lag EPA, so confirm in e-Manifest before filing. The clock is counted from the generator signature; EPA counts from the initial transporter's acceptance, which is the same day or later.\n\nSee your manifests: ${base}/dashboard\nHow exception reports work: ${base}/university/manifests-and-dot\n\nTo stop these reminders, turn them off in Settings: ${base}/settings`;
    const subject = file.length
      ? `Exception Report due: ${file.length} manifest${file.length === 1 ? "" : "s"} past 60 days`
      : `Find signed copy: ${search.length} manifest${search.length === 1 ? "" : "s"} past 45 days`;

    try {
      await sendEmail(to, subject, body);
    } catch (e) {
      if (e instanceof EmailNotConfiguredError) {
        return NextResponse.json({ error: "Email not configured", emailed }, { status: 503 });
      }
      failed++;
      continue;
    }
    emailed++;
    await db.from("exception_report_reminders").upsert(
      items.map((i) => ({ epa_mtn: i.row.epa_mtn, stage: i.stage, user_id: userId })),
      { onConflict: "epa_mtn,stage", ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ candidates: due.length, new: fresh.length, emailed, failed });
}
