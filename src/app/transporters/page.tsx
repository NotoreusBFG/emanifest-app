import { createClient } from "@/lib/supabase/server";
import { listTransporterInvitesForOwner, type TransporterInviteSummary } from "@/services/transporterRegistrationRepository";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { InviteTransporterForm } from "./InviteTransporterForm";
import { InviteRowActions } from "./InviteRowActions";
import { deriveInviteStatus } from "./inviteStatus";

/**
 * Standalone, proactive counterpart to the per-manifest "Invite as
 * transporter" CTA in SendForSignature.tsx — that one only fires
 * reactively, right before a shipment, when a picked transporter turns
 * out to be unregistered. This page lets a generator search for and
 * invite any transporter ahead of time, plus see every invite they've
 * sent and its current status, closing the "no visibility" gap that CTA
 * alone didn't solve.
 */
export default async function TransportersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const invites = user ? await listTransporterInvitesForOwner(supabase) : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Transporters</h1>
        <p className="mt-1 text-gray-600">
          Invite transporters to register with ManifestMate ahead of a shipment, and track who&apos;s
          completed it.
        </p>
      </div>

      <Card className="mt-6 p-4">
        <InviteTransporterForm />
      </Card>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-brand-navy">Invites sent</h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-gray-600">No invites sent yet — search above to send your first one.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {invites.map((invite) => (
              <InviteRow key={invite.tokenId} invite={invite} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteRow({ invite }: { invite: TransporterInviteSummary }) {
  const { variant, label, status } = deriveInviteStatus(invite);
  const name = invite.transporterCompanyName ?? invite.companyNameSnapshot ?? invite.epaSiteId;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-brand-navy">{name}</p>
          <p className="mt-0.5 text-sm text-gray-600">{invite.epaSiteId}</p>
          {invite.manifestEpaMtn && (
            <p className="mt-0.5 text-xs text-gray-500">via manifest {invite.manifestEpaMtn}</p>
          )}
          {invite.transporterHasLoginAccount && (
            <p className="mt-1 text-xs text-gray-500">🔑 Has a ManifestMate login</p>
          )}
          <InviteRowActions invite={invite} status={status} />
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>
    </Card>
  );
}
