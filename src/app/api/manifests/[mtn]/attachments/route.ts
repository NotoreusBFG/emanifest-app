import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError } from "@/lib/rcrainfo/types";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mtn: string }> }) {
  const { mtn } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const parts = await client.getManifestAttachments(mtn);
    const zipPart = parts.find((p) => p.contentType === "application/octet-stream");

    if (!zipPart || !Buffer.isBuffer(zipPart.data)) {
      return NextResponse.json({ error: "No attachment document found for this manifest." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(zipPart.data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="manifest-${mtn}-attachments.zip"`,
      },
    });
  } catch (err) {
    if (err instanceof NoCredentialsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof RcrainfoApiError) {
      return NextResponse.json(
        { error: `RCRAInfo error (${err.status}): ${(err.body as { message?: string })?.message ?? err.message}` },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}
