"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction, signUpAction } from "@/app/actions/authActions";
import { brand, brandGradient } from "@/lib/brandColors";

type ActionState = { success: boolean; error?: string; message?: string } | null;

function SubmitState({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <>
      {state.success === false && (
        <p style={{ color: "red", marginTop: "10px" }}>❌ {state.error}</p>
      )}
      {state.success === true && (
        <p style={{ color: "green", marginTop: "10px" }}>✅ {state.message}</p>
      )}
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

  const [signInState, signInFormAction, signInPending] = useActionState<ActionState, FormData>(
    signInAction,
    null
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState<ActionState, FormData>(
    signUpAction,
    null
  );

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ color: brand.navy }}>Sign in</h1>
      <form
        action={signInFormAction}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: "5px" }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: "5px" }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <button
          type="submit"
          disabled={signInPending}
          style={{
            padding: "10px",
            background: signInPending ? "#ccc" : brandGradient,
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: 600,
            cursor: signInPending ? "not-allowed" : "pointer",
          }}
        >
          {signInPending ? "Signing in..." : "Sign in"}
        </button>
        <SubmitState state={signInState} />
      </form>

      <hr style={{ margin: "30px 0", borderColor: brand.tint }} />

      <h2 style={{ color: brand.navy }}>New here?</h2>
      {next && (
        <p style={{ fontSize: "13px", color: "#666", marginTop: "-5px" }}>
          After you confirm your email, the confirmation link will bring you back here to finish
          what you came for.
        </p>
      )}
      <form
        action={signUpFormAction}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label htmlFor="signup-email" style={{ display: "block", marginBottom: "5px" }}>
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div>
          <label htmlFor="signup-password" style={{ display: "block", marginBottom: "5px" }}>
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            required
            minLength={6}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <button
          type="submit"
          disabled={signUpPending}
          style={{
            padding: "10px",
            backgroundColor: "white",
            color: signUpPending ? "#ccc" : brand.blue,
            border: `2px solid ${signUpPending ? "#ccc" : brand.blue}`,
            borderRadius: "4px",
            fontWeight: 600,
            cursor: signUpPending ? "not-allowed" : "pointer",
          }}
        >
          {signUpPending ? "Creating account..." : "Create account"}
        </button>
        <SubmitState state={signUpState} />
      </form>
    </div>
  );
}
