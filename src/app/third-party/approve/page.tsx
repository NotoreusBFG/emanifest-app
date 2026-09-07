import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCustomerConnectionRequestAction } from "@/app/actions/thirdPartyApprovalActions";
import { ApproveConnectionButtons } from "./ApproveConnectionButtons";
import { ClaimSiteButton } from "./ClaimSiteButton";
import { brand } from "@/lib/brandColors";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Third-party access request</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}

export default async function ApproveThirdPartyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <p>This link is missing its token — ask whoever sent it to resend it.</p>
      </Shell>
    );
  }

  const info = await getCustomerConnectionRequestAction(token);

  if (!info) {
    return (
      <Shell>
        <p>This link isn&apos;t valid — it may have expired. Ask the sender to send a new one.</p>
      </Shell>
    );
  }

  if (info.status === "declined") {
    return (
      <Shell>
        <p>You declined this request. No further access was granted.</p>
      </Shell>
    );
  }

  if (info.status === "revoked") {
    return (
      <Shell>
        <p>This connection has been revoked.</p>
      </Shell>
    );
  }

  if (info.status === "pending") {
    return (
      <Shell>
        <p>
          <strong>{info.thirdPartyEmail}</strong> has asked ManifestMate for permission to create manifests,
          waste profiles, and labels for <strong>{info.siteName}</strong> (EPA ID {info.epaSiteId}) on your
          behalf.
        </p>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Approving only lets them <strong>create</strong> these records — they can&apos;t sign anything as you
          unless you separately invite them as a Quick-Sign delegate in Settings later. No ManifestMate
          account is required to respond.
        </p>
        <ApproveConnectionButtons token={token} />
      </Shell>
    );
  }

  // status === "approved"
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const acceptPath = `/third-party/approve?token=${encodeURIComponent(token)}`;

  return (
    <Shell>
      <p>
        ✅ You&apos;ve approved <strong>{info.thirdPartyEmail}</strong> to create records for{" "}
        <strong>{info.siteName}</strong>.
      </p>
      {user ? (
        <>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Add this site to your own ManifestMate account to review and sign what they create.
          </p>
          <ClaimSiteButton token={token} />
        </>
      ) : (
        <>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Create a free ManifestMate account to review and sign what they create — you&apos;ll be brought
            straight back here afterward.
          </p>
          <Link href={`/login?next=${encodeURIComponent(acceptPath)}`} style={{ color: brand.blue, fontWeight: 600 }}>
            Create an account →
          </Link>
        </>
      )}
    </Shell>
  );
}
