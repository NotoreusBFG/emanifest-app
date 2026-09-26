"use client";

import { useState, useTransition } from "react";
import { setAccountTierAction } from "@/app/actions/entitlementActions";
import type { AccountForTier, AccountTier } from "@/services/entitlementRepository";
import { Card } from "@/components/ui/Card";

const TIER_OPTIONS: { value: AccountTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
];

/**
 * Minimal manual entitlement scaffold (2026-09-26) -- no billing/Stripe,
 * this IS the paywall for now. Writes go through set_account_tier() (see
 * entitlementActions.ts), never a direct client write to profiles.tier.
 * Segregation Wizard requires 'pro', Profile Wizard requires 'plus' --
 * see wizardActions.ts/labPackWizardActions.ts's own gates.
 */
export function TiersSection({ initialAccounts }: { initialAccounts: AccountForTier[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChange = (userId: string, tier: AccountTier) => {
    setError(null);
    setPendingUserId(userId);
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("tier", tier);
    startTransition(async () => {
      try {
        await setAccountTierAction(formData);
        setAccounts((prev) => prev.map((a) => (a.userId === userId ? { ...a, tier } : a)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set tier.");
      } finally {
        setPendingUserId(null);
      }
    });
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy">Account tiers</h2>
      <p className="mt-1 text-gray-600">
        Manual entitlement scaffold — no billing yet, this is the paywall for now. Segregation Wizard requires Pro,
        ManifestMate Wizard requires Plus.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">❌ {error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {accounts.map((account) => (
          <Card key={account.userId} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-brand-navy break-all">{account.email}</p>
                <p className="mt-0.5 text-xs text-gray-400">{account.accountType}</p>
              </div>
              <select
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={account.tier}
                disabled={pendingUserId === account.userId}
                onChange={(e) => handleChange(account.userId, e.target.value as AccountTier)}
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
