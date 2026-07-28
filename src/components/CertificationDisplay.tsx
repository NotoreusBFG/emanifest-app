import { brand } from "@/lib/brandColors";
import type { CertificationText } from "@/lib/rcrainfo/certificationText";

/**
 * Extracted from SignManifestPanel.tsx's SignConfirmationDialog so the
 * public, accountless /sign/[token] driver page (see
 * src/app/sign/[token]/DriverSignForm.tsx) can show the same certification
 * text a logged-in user sees, rather than duplicating this markup.
 */
export function CertificationDisplay({ certification }: { certification: CertificationText }) {
  return (
    <div
      style={{
        backgroundColor: brand.tint,
        borderRadius: "6px",
        padding: "14px",
        margin: "16px 0",
      }}
    >
      <p style={{ fontWeight: 600, color: brand.navy, marginTop: 0, fontSize: "14px" }}>
        {certification.heading}
        {!certification.isVerbatim && (
          <span style={{ fontWeight: 400, color: "#666" }}>
            {" "}
            (summary of the acknowledgment required by this signature)
          </span>
        )}
      </p>
      {certification.paragraphs.map((paragraph, i) => (
        <p key={i} style={{ fontSize: "14px", color: "#333", lineHeight: 1.5 }}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}
