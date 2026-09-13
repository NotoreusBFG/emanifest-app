import { LabPackJobDetail } from "./LabPackJobDetail";

/** Thin server wrapper -- this route needs no server-side data fetch of its
 * own, just the dynamic segment (a Promise in this Next.js version) handed
 * down to the client component that does the actual fetching/mutation,
 * same client-does-the-work shape /lab-packs/page.tsx already uses. */
export default async function LabPackJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <LabPackJobDetail jobId={jobId} />;
}
