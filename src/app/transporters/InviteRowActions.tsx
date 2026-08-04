"use client";

import { useState } from "react";
import {
  cancelTransporterInviteAction,
  revokeTransporterAsInvitingGeneratorAction,
} from "@/app/actions/transporterRegistrationActions";
import type { TransporterInviteSummary } from "@/services/transporterRegistrationRepository";
import type { InviteStatus } from "./inviteStatus";

/**
 * "Cancel invite" (pending only) is low-risk — only ever touches an
 * invite this generator created themselves. "Revoke access" (registered
 * only) is meaningfully more consequential — transporters is a global
 * masterlist, so revoking here can cut off signing access for OTHER
 * generators this same transporter works with too, not just this one.
 * That's why it gets a distinct two-step confirm and cancel doesn't.
 */
export function InviteRowActions({ invite, status }: { invite: TransporterInviteSummary; status: InviteStatus }) {
  const [pending, setPending] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "revoked" | null>(null);

  const handleCancel = async () => {
    setPending(true);
    setError(null);
    const state = await cancelTransporterInviteAction(invite.tokenId);
    setPending(false);
    if (state.success) setDone("cancelled");
    else setError(state.error);
  };

  const handleRevoke = async () => {
    setPending(true);
    setError(null);
    const state = await revokeTransporterAsInvitingGeneratorAction(invite.epaSiteId);
    setPending(false);
    if (state.success) setDone("revoked");
    else setError(state.error);
  };

  if (done === "cancelled") {
    return <p className="mt-2 text-xs text-gray-500">Invite cancelled.</p>;
  }
  if (done === "revoked") {
    return <p className="mt-2 text-xs text-gray-500">Access revoked — whoever registered it was notified.</p>;
  }

  if (status === "pending") {
    return (
      <div className="mt-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleCancel}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Cancel invite"}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (status === "registered") {
    return (
      <div className="mt-2">
        {!confirmingRevoke ? (
          <button
            type="button"
            onClick={() => setConfirmingRevoke(true)}
            className="text-xs text-red-600 hover:underline"
          >
            Revoke access
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">
              This may also affect other generators this transporter works with.
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={handleRevoke}
              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
            >
              {pending ? "Revoking…" : "Confirm revoke"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRevoke(false)}
              className="text-xs text-gray-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return null;
}
