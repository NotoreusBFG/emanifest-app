import Link from "next/link";
import { getInviteStatusAction } from "@/app/actions/delegateActions";
import { AcceptInviteButton } from "./AcceptInviteButton";
import { brand } from "@/lib/brandColors";

export default async function AcceptDelegateInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <p>This link is missing its invite token — ask whoever invited you to resend it.</p>
      </Shell>
    );
  }

  const status = await getInviteStatusAction(token);

  if (status.status === "not-logged-in") {
    return (
      <Shell>
        <p>
          Sign in or create a ManifestMate account with the email address the invite was sent to,
          then come back to this exact link to accept.
        </p>
        <Link href="/login" style={{ color: brand.blue, fontWeight: 600 }}>
          Go to sign in →
        </Link>
      </Shell>
    );
  }

  if (status.status === "wrong-account") {
    return (
      <Shell>
        <p>
          This invite from <strong>{status.ownerEmail}</strong> was sent to{" "}
          <strong>{status.invitedEmail}</strong>, but you&apos;re signed in as{" "}
          <strong>{status.currentEmail}</strong>.
        </p>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Sign out and sign back in (or create an account) with the invited email address, then
          revisit this link.
        </p>
      </Shell>
    );
  }

  if (status.status === "not-found") {
    return (
      <Shell>
        <p>
          This invite link isn&apos;t valid — it may have already been accepted, revoked, or
          expired. Ask whoever invited you to send a new one.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p>
        <strong>{status.ownerEmail}</strong> has invited you to sign hazardous waste manifests on
        their behalf using their EPA credentials — you won&apos;t need your own RCRAInfo
        registration.
      </p>
      <p style={{ color: "#666", fontSize: "14px" }}>
        EPA&apos;s own record will show {status.ownerEmail} as the signer for anything you sign
        this way. ManifestMate separately records that you were the one who actually triggered
        each signature.
      </p>
      <AcceptInviteButton token={token} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Quick-Sign delegate invite</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
