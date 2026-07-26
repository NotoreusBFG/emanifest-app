'use client'

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOnboardingProgressAction,
  saveAndValidateCredentialsAction,
  saveEpaIdStepAction,
  toggleApiKeyGeneratedAction,
  toggleCdxAccountAction,
  toggleEsaCompletedAction,
} from '@/app/actions/onboardingActions';
import type { OnboardingProgress } from '@/services/onboardingRepository';
import { brand, brandGradient } from '@/lib/brandColors';

type StepStatus = 'todo' | 'done' | 'failed';

const STATUS_COLOR: Record<StepStatus, string> = {
  todo: '#ccc',
  done: brand.green,
  failed: '#c0392b',
};

/**
 * Rough v1 -- design pass deferred (see docs/epa-registration-wizard-design.md).
 * Fetches progress client-side on mount (same pattern as the Settings page's
 * emergency-phone field) rather than as a server component, since most of
 * this page is interactive per-step state anyway.
 */
export default function OnboardingPage() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const refresh = () => {
    getOnboardingProgressAction().then((p) => {
      setProgress(p);
      if (p) setExpanded((current) => current ?? firstIncompleteStep(p));
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!progress) {
    return (
      <div style={{ maxWidth: '900px', margin: '40px auto', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#666' }}>Loading…</p>
      </div>
    );
  }

  const statuses: StepStatus[] = [
    progress.cdxAccountDoneAt ? 'done' : 'todo',
    progress.epaIdRequestedAt ? 'done' : 'todo',
    progress.esaCompletedAt ? 'done' : 'todo',
    progress.apiKeyGeneratedAt ? 'done' : 'todo',
    progress.apiCredentialsValidatedAt
      ? 'done'
      : progress.apiCredentialsEnteredAt
      ? 'failed'
      : 'todo',
  ];
  const completeCount = statuses.filter((s) => s === 'done').length;
  const allDone = completeCount === statuses.length;

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h1 style={{ color: brand.navy }}>Get set up with EPA</h1>
      <p style={{ color: '#666' }}>
        Before ManifestMate can create or sign anything on your behalf, you need your own
        RCRAInfo account, EPA ID number, and API credentials — EPA requires this to be tied to
        your own verified identity, so it&apos;s the one part we can&apos;t do for you. Here&apos;s
        every step, in order, tracked so you can pick up where you left off.
      </p>

      <div style={{ margin: '20px 0 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '6px' }}>
          <span>Progress</span>
          <span>{completeCount} of {statuses.length} complete</span>
        </div>
        <div style={{ height: '10px', borderRadius: '999px', background: brand.tint, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${(completeCount / statuses.length) * 100}%`,
              background: brandGradient,
              borderRadius: '999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {allDone && (
        <div
          style={{
            background: brand.tint,
            border: `1px solid ${brand.green}`,
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ color: brand.navy, fontWeight: 600 }}>
            ✅ You&apos;re fully set up — your credentials are saved and verified.
          </span>
          <Link
            href="/manifests/new"
            style={{
              background: brandGradient,
              color: 'white',
              padding: '8px 14px',
              borderRadius: '6px',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            Create your first manifest →
          </Link>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
        }}
      >
        <StepCard
          number={1}
          title="RCRAInfo / CDX account"
          description="Create your online EPA identity."
          status={statuses[0]}
          expanded={expanded === 1}
          onToggle={() => setExpanded((e) => (e === 1 ? null : 1))}
        >
          <p style={StepBodyText}>
            RCRAInfo accounts run through EPA&apos;s Central Data Exchange (CDX). If you don&apos;t
            have one yet, register as an <strong>Industry User</strong> from the RCRAInfo sign-in
            screen.
          </p>
          <ExternalLink href="https://rcrainfo.epa.gov/">
            Go to RCRAInfo sign-in / registration →
          </ExternalLink>
          <ExternalLink href="https://www.epa.gov/e-manifest/e-manifest-user-registration">
            EPA&apos;s e-Manifest registration overview →
          </ExternalLink>
          <CheckboxToggle
            checked={!!progress.cdxAccountDoneAt}
            label="I've created my RCRAInfo/CDX account"
            action={toggleCdxAccountAction}
            onDone={refresh}
          />
        </StepCard>

        <StepCard
          number={2}
          title="Request your EPA ID number"
          description="Site Identification (Form 8700-12)."
          status={statuses[1]}
          expanded={expanded === 2}
          onToggle={() => setExpanded((e) => (e === 2 ? null : 2))}
        >
          <p style={StepBodyText}>
            Once logged into RCRAInfo, look for the <strong>myRCRAid</strong> module (available in
            most states) to submit your Site ID form electronically — otherwise your state
            hazardous waste agency handles it on paper. Approval time varies by state; it&apos;s
            not instant.
          </p>
          <ExternalLink href="https://www.epa.gov/hwgenerators/instructions-and-form-hazardous-waste-generators-transporters-and-treatment-storage">
            EPA ID number / Form 8700-12 instructions →
          </ExternalLink>
          <EpaIdForm
            requested={!!progress.epaIdRequestedAt}
            epaIdNumber={progress.epaIdNumber ?? ''}
            onDone={refresh}
          />
        </StepCard>

        <StepCard
          number={3}
          title="Site Manager permission + signature agreement"
          description="Identity-proofing (ESA)."
          status={statuses[2]}
          expanded={expanded === 3}
          onToggle={() => setExpanded((e) => (e === 3 ? null : 3))}
        >
          <p style={StepBodyText}>
            Request Site Manager or Certifier permission for your site, then complete the{' '}
            <strong>Electronic Signature Agreement</strong>. Choose the <strong>online identity
            proofing</strong> option if it&apos;s offered — it can approve you immediately, versus
            days or weeks for the notarized paper form.
          </p>
          <ExternalLink href="https://rcrainfo.epa.gov/">
            Continue in RCRAInfo →
          </ExternalLink>
          <CheckboxToggle
            checked={!!progress.esaCompletedAt}
            label="I've completed the Electronic Signature Agreement"
            action={toggleEsaCompletedAction}
            onDone={refresh}
          />
        </StepCard>

        <StepCard
          number={4}
          title="Generate your API ID and Key"
          description="Inside RCRAInfo, Tools → API."
          status={statuses[3]}
          expanded={expanded === 4}
          onToggle={() => setExpanded((e) => (e === 4 ? null : 4))}
        >
          <p style={StepBodyText}>
            Only visible once you&apos;re a Site Manager. In RCRAInfo, go to <strong>Tools → API</strong>{' '}
            to generate your unique API ID and Key — these are what let ManifestMate act on your
            behalf, so keep them private.
          </p>
          <ExternalLink href="https://rcrainfo.epa.gov/">
            Continue in RCRAInfo →
          </ExternalLink>
          <CheckboxToggle
            checked={!!progress.apiKeyGeneratedAt}
            label="I've generated my API ID and Key"
            action={toggleApiKeyGeneratedAction}
            onDone={refresh}
          />
        </StepCard>

        <StepCard
          number={5}
          title="Add & verify your credentials"
          description="Paste them in — we'll test them."
          status={statuses[4]}
          expanded={expanded === 5}
          onToggle={() => setExpanded((e) => (e === 5 ? null : 5))}
        >
          <p style={StepBodyText}>
            Paste the API ID and Key from step 4. We&apos;ll save them securely and make a real
            test call to RCRAInfo to confirm they work.
          </p>
          <CredentialsForm onDone={refresh} />
        </StepCard>
      </div>
    </div>
  );
}

/** Auto-expands the next thing to do -- `null` once everything (including
 * step 5's real credential validation) is done, so a returning fully-set-up
 * user sees the completion banner with every box collapsed, not the
 * credentials form popped open again for no reason. */
function firstIncompleteStep(p: OnboardingProgress): number | null {
  if (!p.cdxAccountDoneAt) return 1;
  if (!p.epaIdRequestedAt) return 2;
  if (!p.esaCompletedAt) return 3;
  if (!p.apiKeyGeneratedAt) return 4;
  if (!p.apiCredentialsValidatedAt) return 5;
  return null;
}

const StepBodyText: React.CSSProperties = { fontSize: '13px', color: '#555', lineHeight: 1.5 };

function StepCard({
  number,
  title,
  description,
  status,
  expanded,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  description: string;
  status: StepStatus;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${expanded ? brand.blue : '#e0e0e0'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'white',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#999', fontWeight: 600 }}>STEP {number}</span>
          <span
            aria-hidden
            title={status === 'done' ? 'Done' : status === 'failed' ? 'Needs attention' : 'Not started'}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              background: STATUS_COLOR[status],
              boxShadow: status === 'done' ? `0 0 6px ${brand.green}` : 'none',
              flexShrink: 0,
            }}
          />
        </div>
        <span style={{ fontWeight: 600, color: brand.navy, fontSize: '14px' }}>{title}</span>
        <span style={{ fontSize: '12px', color: '#888' }}>{description}</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p style={{ margin: '8px 0' }}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: brand.blue, fontSize: '13px' }}>
        {children}
      </a>
    </p>
  );
}

/** Fires the boolean-toggle action directly (no <form>/useActionState
 * needed for a single checkbox) and refreshes the shared progress state. */
function CheckboxToggle({
  checked,
  label,
  action,
  onDone,
}: {
  checked: boolean;
  label: string;
  action: (prevState: any, formData: FormData) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);

  const handleChange = async (next: boolean) => {
    setPending(true);
    const fd = new FormData();
    fd.set('done', String(next));
    await action(null, fd);
    setPending(false);
    onDone();
  };

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', marginTop: '10px', cursor: pending ? 'wait' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => handleChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function EpaIdForm({
  requested,
  epaIdNumber,
  onDone,
}: {
  requested: boolean;
  epaIdNumber: string;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveEpaIdStepAction, null);
  const [checked, setChecked] = useState(requested);
  const [idValue, setIdValue] = useState(epaIdNumber);

  useEffect(() => {
    if (state?.success) onDone();
  }, [state]);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333' }}>
        <input
          type="checkbox"
          name="requested"
          value="true"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I&apos;ve submitted my Site ID request
      </label>
      <div>
        <label htmlFor="epaIdNumber" style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
          EPA ID number (once you have it)
        </label>
        <input
          id="epaIdNumber"
          name="epaIdNumber"
          type="text"
          value={idValue}
          onChange={(e) => setIdValue(e.target.value)}
          placeholder="e.g. VAD000532119"
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      {/* Hidden input keeps unchecked-checkbox semantics working -- an
          unchecked checkbox sends no value at all, but this form needs to
          be able to explicitly clear `requested` back to false too. */}
      {!checked && <input type="hidden" name="requested" value="false" />}
      <button
        type="submit"
        disabled={isPending}
        style={{
          alignSelf: 'flex-start',
          padding: '6px 12px',
          background: isPending ? '#ccc' : brandGradient,
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {state?.error && <p style={{ color: '#c0392b', fontSize: '12px' }}>{state.error}</p>}
    </form>
  );
}

function CredentialsForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(saveAndValidateCredentialsAction, null);

  useEffect(() => {
    if (state?.success) onDone();
  }, [state]);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      <div>
        <label htmlFor="ob-apiId" style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
          API ID
        </label>
        <input
          id="ob-apiId"
          name="apiId"
          type="text"
          required
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <div>
        <label htmlFor="ob-apiKey" style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
          API Key
        </label>
        <input
          id="ob-apiKey"
          name="apiKey"
          type="password"
          required
          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        style={{
          alignSelf: 'flex-start',
          padding: '6px 12px',
          background: isPending ? '#ccc' : brandGradient,
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Verifying…' : 'Save & verify'}
      </button>
      {state?.success && <p style={{ color: brand.green, fontSize: '12px' }}>✅ {state.message}</p>}
      {state?.success === false && <p style={{ color: '#c0392b', fontSize: '12px' }}>❌ {state.error}</p>}
    </form>
  );
}
