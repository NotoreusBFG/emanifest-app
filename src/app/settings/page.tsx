'use client' // 1. This tells Next.js this file has interactive buttons and state

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  saveEpaSettingsAction,
  saveDefaultEmergencyPhoneAction,
  getDefaultEmergencyPhoneAction,
} from '@/app/actions/epaActions';
import { signOutAction } from '@/app/actions/authActions';
import {
  inviteDelegateAction,
  listMyDelegatesAction,
  revokeDelegateAction,
} from '@/app/actions/delegateActions';
import type { DelegateRecord, DelegateSiteType } from '@/services/delegateRepository';
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function EpaSettingsPage() {
  // 2. 'useActionState' connects our form to the Server Action.
  // [state] = the result (success/error)
  // [formAction] = the function we link to the form
  // [isPending] = true if the form is currently saving
  const [state, formAction, isPending] = useActionState(saveEpaSettingsAction, null);

  const [phoneState, savePhoneAction, isPhonePending] = useActionState(
    saveDefaultEmergencyPhoneAction,
    null
  );

  // Pre-fills with whatever the user has already saved -- unlike the API
  // credentials (write-only, never redisplayed since they're secrets),
  // the emergency phone isn't sensitive, so showing the current value
  // saves having to remember/retype it. Controlled (not defaultValue) so
  // it survives this form's own submissions like every other controlled
  // field in this app.
  const [defaultEmergencyPhone, setDefaultEmergencyPhone] = useState('');
  useEffect(() => {
    getDefaultEmergencyPhoneAction().then((phone) => {
      if (phone) setDefaultEmergencyPhone(phone);
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">Settings</h1>
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-medium text-brand-blue hover:underline">
            Sign out
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-brand-navy">RCRAInfo API credentials</h2>
          <p className="mt-1 text-sm text-gray-600">Securely store your API credentials.</p>

          {/* 3. The 'action' prop tells the form to run our Server Action when submitted */}
          <form action={formAction} className="mt-4 flex flex-col gap-4">
            <Input id="apiId" name="apiId" type="text" label="EPA Site ID (API ID)" required />
            <Input id="apiKey" name="apiKey" type="password" label="EPA Secret Key" required />

            {/* 4. We use 'isPending' to disable the button so the user doesn't click twice */}
            <Button type="submit" disabled={isPending} className="self-start">
              {isPending ? 'Saving Securely...' : 'Save Credentials'}
            </Button>

            {/* 5. Show a message to the user based on the 'state' returned by the Server Action */}
            {state?.success && <p className="text-sm text-green-700">✅ {state.message}</p>}
            {state?.error && <p className="text-sm text-red-600">❌ {state.error}</p>}
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-brand-navy">Default emergency phone</h2>
          <p className="mt-1 text-sm text-gray-600">
            Pre-fills the emergency response phone field when creating a manifest — still
            editable per manifest. Independent of your API credentials above, so updating this
            never requires re-entering your API key.
          </p>

          <form action={savePhoneAction} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="defaultEmergencyPhone"
                name="defaultEmergencyPhone"
                type="text"
                label="Emergency phone number"
                placeholder={`${SYSTEM_DEFAULT_EMERGENCY_PHONE} (system default)`}
                value={defaultEmergencyPhone}
                onChange={(e) => setDefaultEmergencyPhone(e.target.value)}
                hint={`Leave blank to use the system default (${SYSTEM_DEFAULT_EMERGENCY_PHONE}).`}
              />
            </div>

            <Button type="submit" disabled={isPhonePending}>
              {isPhonePending ? 'Saving...' : 'Save phone number'}
            </Button>
          </form>
          {phoneState?.success && <p className="mt-2 text-sm text-green-700">✅ {phoneState.message}</p>}
          {phoneState?.error && <p className="mt-2 text-sm text-red-600">❌ {phoneState.error}</p>}
        </Card>

        <Card className="p-6">
          <DelegatesSection />
        </Card>
      </div>

      <p className="mt-6">
        <Link href="/manifests" className="text-brand-blue hover:underline">
          Look up a manifest →
        </Link>
      </p>
    </div>
  );
}

const SITE_TYPE_OPTIONS: { value: DelegateSiteType; label: string; warn?: boolean }[] = [
  {
    value: 'Generator',
    label: 'Generator — the "cradle to grave" signature; grant carefully',
    warn: true,
  },
  { value: 'Transporter', label: 'Transporter (e.g. a driver)' },
  { value: 'Tsdf', label: 'Designated facility' },
];

/**
 * Quick-Sign delegation ("sign on my behalf without their own EPA
 * credentials") -- see docs/delegate-quick-sign-design.md. No transactional
 * email is wired up in this project, so an invite produces a shareable link
 * the owner copies and sends themselves, rather than an automatic email.
 */
function DelegatesSection() {
  const [delegates, setDelegates] = useState<DelegateRecord[] | null>(null);
  const [inviteState, inviteFormAction, isInvitePending] = useActionState(
    inviteDelegateAction,
    null
  );
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inviteLinkFor = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/delegate/accept?token=${token}` : '';

  const handleCopy = (id: string, link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    });
  };

  const refreshDelegates = () => {
    listMyDelegatesAction().then(setDelegates);
  };

  useEffect(() => {
    refreshDelegates();
  }, []);

  // Re-fetch after a successful invite so the new pending row shows up
  // without the owner needing to reload the page.
  useEffect(() => {
    if (inviteState?.success) refreshDelegates();
  }, [inviteState]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    const result = await revokeDelegateAction(id);
    setRevokingId(null);
    setRevokeMessage(result?.success ? result.message : result?.error ?? null);
    refreshDelegates();
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-brand-navy">Quick-Sign delegates</h2>
      <p className="mt-1 text-sm text-gray-600">
        Invite someone to sign manifests using your EPA credentials — useful for drivers or staff
        who shouldn&apos;t need their own RCRAInfo registration. EPA&apos;s own record will still
        show you as the signer; ManifestMate separately tracks who actually triggered each
        signature (see the FAQ).
      </p>

      <form action={inviteFormAction} className="mt-4 flex flex-col gap-3">
        <Input id="invitedEmail" name="invitedEmail" type="email" label="Email to invite" required />

        <div>
          <p className="mb-0.5 text-sm text-brand-navy">Allow signing as:</p>
          <p className="mb-1.5 text-xs text-gray-500">
            Leave all unchecked to allow any role your own credentials permit.
          </p>
          {SITE_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="mb-1 flex items-start gap-1.5 text-xs"
              style={{ color: opt.warn ? '#a15c00' : '#333' }}
            >
              <input type="checkbox" name="allowedSiteTypes" value={opt.value} className="mt-0.5" />
              {opt.label}
            </label>
          ))}
        </div>

        <Button type="submit" disabled={isInvitePending} className="self-start px-4 py-2 text-sm">
          {isInvitePending ? 'Creating invite...' : 'Create invite link'}
        </Button>

        {inviteState?.success && (
          <p className="break-all text-sm text-green-700">✅ {inviteState.message}</p>
        )}
        {inviteState?.success === false && <p className="text-sm text-red-600">❌ {inviteState.error}</p>}
      </form>

      {delegates && delegates.length > 0 && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 font-medium">Email</th>
              <th className="py-1 font-medium">Status</th>
              <th className="py-1 font-medium">Roles</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {delegates.map((d) => {
              const status = d.revoked_at ? 'Revoked' : d.accepted_at ? 'Active' : 'Pending';
              const link = status === 'Pending' ? inviteLinkFor(d.invite_token) : null;
              return (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="py-1.5">
                    {d.invited_email}
                    {link && (
                      <div className="mt-1 flex items-center gap-2">
                        <code className="break-all rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {link}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(d.id, link)}
                          className="whitespace-nowrap text-xs font-semibold text-brand-blue"
                        >
                          {copiedId === d.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-1.5">{status}</td>
                  <td className="py-1.5">{d.allowed_site_types?.join(', ') || 'All'}</td>
                  <td className="py-1.5 text-right">
                    {!d.revoked_at && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(d.id)}
                        disabled={revokingId === d.id}
                        className="text-sm text-brand-blue disabled:cursor-not-allowed"
                      >
                        {revokingId === d.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {revokeMessage && <p className="mt-1.5 text-sm text-gray-600">{revokeMessage}</p>}
    </div>
  );
}
