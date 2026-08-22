import { confirmUnsubscribeAction } from "@/app/actions/unsubscribeActions";
import { Card } from "@/components/ui/Card";

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { leadId } = await params;
  const { done } = await searchParams;

  if (done === "1") {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-brand-navy">You&apos;re unsubscribed</h1>
          <p className="mt-3 text-gray-600">
            You won&apos;t receive further marketing emails from ManifestMate. If this was a mistake,
            just reply to any prior email and let us know.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-bold text-brand-navy">Unsubscribe from ManifestMate emails</h1>
        <p className="mt-3 text-gray-600">
          Click below to stop receiving marketing emails from ManifestMate at this address.
        </p>
        <form action={confirmUnsubscribeAction} className="mt-6">
          <input type="hidden" name="leadId" value={leadId} />
          <button
            type="submit"
            className="rounded-full px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            Confirm unsubscribe
          </button>
        </form>
      </Card>
    </div>
  );
}
