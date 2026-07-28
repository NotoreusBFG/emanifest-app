import { getDriverSignSessionAction } from "@/app/actions/driverSignActions";
import { DriverSignForm } from "./DriverSignForm";
import { brand } from "@/lib/brandColors";

/**
 * Public, accountless route — deliberately NOT in middleware.ts's
 * protectedPaths list. A driver taps an SMS link and reviews/signs this
 * manifest with no ManifestMate login, no RCRAInfo registration of their
 * own — see src/app/actions/driverSignActions.ts for the security model
 * (token-gated SECURITY DEFINER functions, not RLS row visibility).
 */
export default async function DriverSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getDriverSignSessionAction(token);

  return (
    <Shell>
      {state.success ? (
        <DriverSignForm token={token} session={state.session} />
      ) : (
        <p style={{ color: "#666" }}>{state.error}</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Sign for pickup — ManifestMate</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
