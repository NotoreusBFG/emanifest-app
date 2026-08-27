import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileGate } from "@/services/profileRepository";
import { signOutAction } from "@/app/actions/authActions";
import { Card } from "@/components/ui/Card";

/**
 * Landing spot for a generator whose signup is confirmed but not yet
 * approved (see 2026090601_add_approval_gate_to_profiles.sql). The
 * middleware bounces any protected-route request here for such a user;
 * this page itself re-checks status so someone who's since been approved
 * (or who lands here directly, already approved) gets sent on to
 * /dashboard instead of seeing a stale "pending" message.
 */
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { approved } = await getProfileGate(supabase, user.id);
  if (approved) redirect("/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
      <Card className="w-full p-8 text-center">
        <h1 className="text-xl font-bold text-brand-navy">Your account is awaiting approval</h1>
        <p className="mt-3 text-sm text-gray-600">
          Thanks for confirming your email. We manually review new accounts before granting
          access — you&apos;ll be notified once yours is approved.
        </p>
        <form action={signOutAction} className="mt-6">
          <button type="submit" className="text-sm font-medium text-brand-blue hover:underline">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
