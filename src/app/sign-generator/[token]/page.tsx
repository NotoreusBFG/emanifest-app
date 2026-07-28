import { getGeneratorSignSessionAction } from "@/app/actions/generatorSignActions";
import { GeneratorSignForm } from "./GeneratorSignForm";
import { brand } from "@/lib/brandColors";

/**
 * Public, accountless route — deliberately NOT in middleware.ts's
 * protectedPaths list (none of ["/settings","/manifests","/dashboard",
 * "/onboarding","/ldr"] prefix-match "/sign-generator"). Lets someone the
 * account owner invites sign the Generator role using the OWNER'S OWN
 * RCRAInfo credentials, with no ManifestMate account of their own — see
 * src/app/actions/generatorSignActions.ts for the security model
 * (token-gated SECURITY DEFINER functions, not RLS row visibility, same
 * as the sibling /sign/[token] driver flow).
 */
export default async function GeneratorSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getGeneratorSignSessionAction(token);

  return (
    <Shell>
      {state.success ? (
        <GeneratorSignForm token={token} session={state.session} />
      ) : (
        <p style={{ color: "#666" }}>{state.error}</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "480px", margin: "60px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ color: brand.navy, fontSize: "22px" }}>Sign as generator — ManifestMate</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
        {children}
      </div>
    </div>
  );
}
