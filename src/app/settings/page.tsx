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
import { brand, brandGradient } from '@/lib/brandColors';
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from '@/lib/constants';

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
    <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ color: brand.navy }}>EPA Settings</h1>
        <form action={signOutAction}>
          <button type="submit" style={{ background: 'none', border: 'none', color: brand.blue, cursor: 'pointer' }}>
            Sign out
          </button>
        </form>
      </div>
      <p style={{ color: '#666' }}>Securely store your API credentials.</p>

      {/* 3. The 'action' prop tells the form to run our Server Action when submitted */}
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label htmlFor="apiId" style={{ display: 'block', marginBottom: '5px' }}>EPA Site ID (API ID)</label>
          <input
            id="apiId"
            name="apiId" // This name MUST match what we look for in 'epaActions.ts'
            type="text"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '5px' }}>EPA Secret Key</label>
          <input
            id="apiKey"
            name="apiKey" // This name MUST match what we look for in 'epaActions.ts'
            type="password"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        {/* 4. We use 'isPending' to disable the button so the user doesn't click twice */}
        <button 
          type="submit" 
          disabled={isPending}
          style={{
            padding: '10px',
            background: isPending ? '#ccc' : brandGradient,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer'
          }}
        >
          {isPending ? 'Saving Securely...' : 'Save Credentials'}
        </button>

        {/* 5. Show a message to the user based on the 'state' returned by the Server Action */}
        {state?.success && (
          <p style={{ color: 'green', marginTop: '10px' }}>✅ {state.message}</p>
        )}
        {state?.error && (
          <p style={{ color: 'red', marginTop: '10px' }}>❌ {state.error}</p>
        )}
      </form>

      <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <h2 style={{ color: brand.navy, fontSize: '18px' }}>Default emergency phone</h2>
      <p style={{ color: '#666' }}>
        Pre-fills the emergency response phone field when creating a manifest — still
        editable per manifest. Independent of your API credentials above, so updating
        this never requires re-entering your API key.
      </p>

      <form action={savePhoneAction} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label htmlFor="defaultEmergencyPhone" style={{ display: 'block', marginBottom: '5px' }}>
            Emergency phone number
          </label>
          <input
            id="defaultEmergencyPhone"
            name="defaultEmergencyPhone"
            type="text"
            placeholder={`${SYSTEM_DEFAULT_EMERGENCY_PHONE} (system default)`}
            value={defaultEmergencyPhone}
            onChange={(e) => setDefaultEmergencyPhone(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: '13px', color: '#888', marginTop: '5px' }}>
            Leave blank to use the system default ({SYSTEM_DEFAULT_EMERGENCY_PHONE}).
          </p>
        </div>

        <button
          type="submit"
          disabled={isPhonePending}
          style={{
            padding: '10px',
            background: isPhonePending ? '#ccc' : brandGradient,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: isPhonePending ? 'not-allowed' : 'pointer'
          }}
        >
          {isPhonePending ? 'Saving...' : 'Save phone number'}
        </button>

        {phoneState?.success && (
          <p style={{ color: 'green', marginTop: '10px' }}>✅ {phoneState.message}</p>
        )}
        {phoneState?.error && (
          <p style={{ color: 'red', marginTop: '10px' }}>❌ {phoneState.error}</p>
        )}
      </form>

      <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <DelegatesSection />

      <p style={{ marginTop: '20px' }}>
        <Link href="/manifests" style={{ color: brand.blue }}>Look up a manifest →</Link>
      </p>
    </div>
  );
}

const SITE_TYPE_OPTIONS: { value: DelegateSiteType; label: string; warn?: boolean }[] = [
  { value: 'Transporter', label: 'Transporter (e.g. a driver)' },
  { value: 'Tsdf', label: 'Designated facility' },
  {
    value: 'Generator',
    label: 'Generator — the "cradle to grave" signature; grant carefully',
    warn: true,
  },
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
      <h2 style={{ color: brand.navy, fontSize: '18px' }}>Quick-Sign delegates</h2>
      <p style={{ color: '#666' }}>
        Invite someone to sign manifests using your EPA credentials — useful for drivers or
        staff who shouldn&apos;t need their own RCRAInfo registration. EPA&apos;s own record will
        still show you as the signer; ManifestMate separately tracks who actually triggered each
        signature (see the FAQ).
      </p>

      <form
        action={inviteFormAction}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}
      >
        <div>
          <label htmlFor="invitedEmail" style={{ display: 'block', marginBottom: '5px' }}>
            Email to invite
          </label>
          <input
            id="invitedEmail"
            name="invitedEmail"
            type="email"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <p style={{ marginBottom: '5px', fontSize: '14px' }}>Allow signing as:</p>
          {SITE_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '13px',
                color: opt.warn ? '#a15c00' : '#333',
                marginBottom: '4px',
              }}
            >
              <input
                type="checkbox"
                name="allowedSiteTypes"
                value={opt.value}
                defaultChecked={opt.value === 'Transporter'}
                style={{ marginTop: '2px' }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={isInvitePending}
          style={{
            padding: '10px',
            background: isInvitePending ? '#ccc' : brandGradient,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: isInvitePending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {isInvitePending ? 'Creating invite...' : 'Create invite link'}
        </button>

        {inviteState?.success && (
          <p style={{ color: 'green', marginTop: '5px', wordBreak: 'break-all', fontSize: '13px' }}>
            ✅ {inviteState.message}
          </p>
        )}
        {inviteState?.success === false && (
          <p style={{ color: 'red', marginTop: '5px' }}>❌ {inviteState.error}</p>
        )}
      </form>

      {delegates && delegates.length > 0 && (
        <table style={{ width: '100%', marginTop: '15px', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#888' }}>
              <th style={{ padding: '4px 0' }}>Email</th>
              <th style={{ padding: '4px 0' }}>Status</th>
              <th style={{ padding: '4px 0' }}>Roles</th>
              <th style={{ padding: '4px 0' }} />
            </tr>
          </thead>
          <tbody>
            {delegates.map((d) => {
              const status = d.revoked_at ? 'Revoked' : d.accepted_at ? 'Active' : 'Pending';
              return (
                <tr key={d.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '6px 0' }}>{d.invited_email}</td>
                  <td style={{ padding: '6px 0' }}>{status}</td>
                  <td style={{ padding: '6px 0' }}>{d.allowed_site_types?.join(', ') || 'All'}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>
                    {!d.revoked_at && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(d.id)}
                        disabled={revokingId === d.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: brand.blue,
                          cursor: revokingId === d.id ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                        }}
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
      {revokeMessage && (
        <p style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>{revokeMessage}</p>
      )}
    </div>
  );
}