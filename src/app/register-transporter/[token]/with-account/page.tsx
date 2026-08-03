import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTransporterRegistrationSessionAction } from "@/app/actions/transporterRegistrationActions";
import { TransporterRegistrationForm } from "../TransporterRegistrationForm";
import { brand } from "@/lib/brandColors";

/**
 * Login-based alternative to the accountless /register-transporter/[token]
 * flow. Does its OWN inline auth check (same pattern as
 * src/app/delegate/accept/page.tsx) rather than relying on middleware.ts --
 * protectedPaths is prefix-matched and the base /register-transporter/[token]
 * route must stay public, so a broader "/register-transporter" prefix can't
 * be added without breaking the accountless path.
 *
 * TransporterRegistrationForm itself is reused completely unmodified -- it
 * has zero auth-awareness. Because complete_transporter_registration now
 * derives owner_user_id from auth.uid() server-side (see
 * 20260815_transporter_owner_account_and_invite_status.sql), the SAME
 * component produces an owned registration here and a null-owned one on
 * the anonymous base page, with no new props or forked form.
 */
export default async function RegisterTransporterWithAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const acceptPath = `/register-transporter/${token}/with-account`;

  if (!user) {
    return (
      <Shell>
        <p>
          Sign in or create a ManifestMate account to complete this registration — you&apos;ll be
          brought straight back here afterward.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(acceptPath)}`}
          style={{ color: brand.blue, fontWeight: 600 }}
        >
          Go to sign in →
        </Link>
      </Shell>
    );
  }

  const state = await getTransporterRegistrationSessionAction(token);

  return (
    <Shell>
      {state.success ? (
        <>
          <p style={{ fontSize: "12px", color: "#888" }}>
            Signed in as {user.email} — completing this will link the registration to your
            ManifestMate account.
          </p>
          <TransporterRegistrationForm token={token} session={state.session} />
        </>
      ) : (
        <p style={{ color: "#666" }}>{state.error}</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Register as a transporter — ManifestMate</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
