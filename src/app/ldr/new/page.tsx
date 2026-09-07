import Link from "next/link";
import { brand } from "@/lib/brandColors";

const cardStyle = {
  flex: "1 1 280px",
  textDecoration: "none",
  border: `1px solid ${brand.tint}`,
  borderRadius: "8px",
  padding: "20px",
  display: "block",
  color: "inherit",
};

/**
 * Landing choice for "+ File a new notice" -- two very different paths
 * that both end up as a row in ldr_notices (see 20260822_add_third_party_ldr_notices.sql):
 * a third-party PDF someone else already prepared (no structured data
 * needed, just who sent it and which MTN), or ManifestMate's own
 * structured A-I letter form. `?mtn=` (from a manifest deep link) is
 * passed through to whichever path is chosen.
 */
export default async function NewLdrChoicePage({
  searchParams,
}: {
  searchParams: Promise<{ mtn?: string }>;
}) {
  const { mtn } = await searchParams;
  const mtnQuery = mtn ? `?mtn=${encodeURIComponent(mtn)}` : "";

  return (
    <div style={{ maxWidth: "760px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <p>
        <Link href="/ldr" style={{ color: brand.blue }}>
          ← Back to LDR notices
        </Link>
      </p>
      <h1 style={{ color: brand.navy }}>File an LDR notice</h1>
      <p style={{ color: "#666" }}>40 CFR 268.7(a) — how do you want to record this notice?</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "20px" }}>
        <Link href={`/ldr/new/third-party${mtnQuery}`} style={cardStyle}>
          <h2 style={{ color: brand.navy, margin: "0 0 8px", fontSize: "17px" }}>
            Upload a notice I already have
          </h2>
          <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>
            The receiving facility, a broker, or a lab already sent you a finished LDR notice as a
            PDF. Record who sent it and which shipment it&apos;s for, then attach the file —
            ManifestMate doesn&apos;t generate or certify anything here, it just keeps the document
            on file for you.
          </p>
        </Link>

        <Link href={`/ldr/new/prepared${mtnQuery}`} style={cardStyle}>
          <h2 style={{ color: brand.navy, margin: "0 0 8px", fontSize: "17px" }}>Prepare a new notice</h2>
          <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>
            Select the manifest this shipment is on — draft or already signed — and ManifestMate
            pulls its waste codes for you. You finish by choosing how each must be managed (letters
            A–I) and signing any certifications required.
          </p>
        </Link>
      </div>
    </div>
  );
}
