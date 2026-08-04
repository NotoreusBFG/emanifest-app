import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { brand } from "@/lib/brandColors";
import type { OnboardingProgress } from "@/services/onboardingRepository";
import {
  deriveOnboardingStepStatuses,
  deriveOverallOnboardingStatus,
  type OnboardingStepStatuses,
  type StepStatus,
} from "@/lib/onboardingStatus";

/** Red = not started, yellow = only reachable by the API-credentials step
 * (saved but not yet verified), green = done. */
const STATUS_DOT_COLOR: Record<StepStatus, string> = {
  todo: "#c0392b",
  failed: "#c98a00",
  done: brand.green,
};

const OVERALL_COLOR = { red: "#c0392b", yellow: "#c98a00", green: brand.green } as const;
const OVERALL_LABEL = {
  red: "Setup needed",
  yellow: "Setup in progress",
  green: "Fully set up",
} as const;

const CRITERIA: { key: keyof OnboardingStepStatuses; label: string }[] = [
  { key: "cdxAccount", label: "RCRAInfo/CDX account" },
  { key: "epaId", label: "EPA ID number" },
  { key: "esa", label: "Site Manager + signature agreement" },
  { key: "apiKeyGenerated", label: "API ID/Key generated" },
  { key: "apiCredentials", label: "API keys" },
];

const STATUS_TITLE: Record<StepStatus, string> = {
  done: "Done",
  failed: "Saved, but not verified yet",
  todo: "Not started",
};

/**
 * Onboarding-status widget for the generator dashboard landing page --
 * surfaces login identity plus every EPA/RCRAInfo setup criterion so a
 * customer notices right away if something (most importantly, working API
 * keys) is still missing. Transporter accounts never hold their own EPA
 * credentials (signing stays on the accountless SMS driver flow), so this
 * card is generator-only -- see transporter-dashboard/page.tsx.
 */
export function AccountStatusCard({
  email,
  progress,
}: {
  email: string;
  progress: OnboardingProgress;
}) {
  const stepStatuses = deriveOnboardingStepStatuses(progress);
  const overall = deriveOverallOnboardingStatus(stepStatuses);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Logged in as</p>
          <p className="truncate text-sm font-semibold text-brand-navy">{email}</p>
        </div>

        <Link
          href="/onboarding"
          className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold hover:underline"
          style={{ backgroundColor: `${OVERALL_COLOR[overall]}1a`, color: OVERALL_COLOR[overall] }}
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: OVERALL_COLOR[overall] }}
          />
          {OVERALL_LABEL[overall]}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3">
        {CRITERIA.map((c) => (
          <Link
            key={c.key}
            href="/onboarding"
            title={STATUS_TITLE[stepStatuses[c.key]]}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-navy"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_DOT_COLOR[stepStatuses[c.key]] }}
            />
            {c.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
