"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { signInAction, signUpAction } from "@/app/actions/authActions";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type ActionState = { success: boolean; error?: string; message?: string } | null;

function SubmitState({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <>
      {state.success === false && <p className="mt-2 text-sm text-red-600">❌ {state.error}</p>}
      {state.success === true && <p className="mt-2 text-sm text-green-700">✅ {state.message}</p>}
    </>
  );
}

// useSearchParams() (for the ?next= redirect target, e.g. from a delegate
// invite link) requires a Suspense boundary in the App Router, or the
// build fails — same pattern as /manifests's ?mtn= deep link.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const accountTypeHint = searchParams.get("accountType") === "transporter" ? "transporter" : "generator";
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [signInState, signInFormAction, signInPending] = useActionState<ActionState, FormData>(
    signInAction,
    null
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState<ActionState, FormData>(
    signUpAction,
    null
  );

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      style={{ background: "linear-gradient(160deg, #0a2246, #0f2d59)" }}
    >
      <Image
        src="/manifestmate-logo.jpg"
        alt="ManifestMate"
        width={200}
        height={56}
        className="mb-8 rounded"
        priority
      />

      <Card className="w-full max-w-sm p-8">
        {mode === "signin" ? (
          <>
            <h1 className="text-xl font-bold text-brand-navy">Sign in</h1>
            <form action={signInFormAction} className="mt-6 flex flex-col gap-4">
              {next && <input type="hidden" name="next" value={next} />}
              <Input id="email" name="email" type="email" label="Email" required />
              <Input id="password" name="password" type="password" label="Password" required />
              <Button type="submit" disabled={signInPending} className="mt-2">
                {signInPending ? "Signing in..." : "Sign in"}
              </Button>
              <SubmitState state={signInState} />
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-brand-blue hover:underline"
              >
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-brand-navy">Create an account</h1>
            {next && (
              <p className="mt-1 text-xs text-gray-500">
                After you confirm your email, the confirmation link will bring you back here to
                finish what you came for.
              </p>
            )}
            <form action={signUpFormAction} className="mt-6 flex flex-col gap-4">
              {next && <input type="hidden" name="next" value={next} />}
              <Input id="signup-email" name="email" type="email" label="Email" required />
              <Input
                id="signup-password"
                name="password"
                type="password"
                label="Password"
                required
                minLength={6}
              />
              <fieldset className="flex gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="account_type"
                    value="generator"
                    defaultChecked={accountTypeHint === "generator"}
                  />
                  I generate hazardous waste
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="account_type"
                    value="transporter"
                    defaultChecked={accountTypeHint === "transporter"}
                  />
                  I&apos;m a transporter company
                </label>
              </fieldset>
              <Button type="submit" disabled={signUpPending} className="mt-2">
                {signUpPending ? "Creating account..." : "Create account"}
              </Button>
              <SubmitState state={signUpState} />
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-medium text-brand-blue hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
