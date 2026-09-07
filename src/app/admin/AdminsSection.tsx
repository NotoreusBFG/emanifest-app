"use client";

import { useActionState, useEffect, useState } from "react";
import { grantAdminAction, revokeAdminAction, listAdminsAction } from "@/app/actions/adminActions";
import type { AdminRecord, AdminRole } from "@/services/adminRepository";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Admin access is never self-declared -- only a super admin can grant or
 * revoke it (grant_admin()/revoke_admin() both check is_super_admin_caller()
 * server-side; this UI just reflects that, it isn't the real boundary). A
 * plain admin sees the list read-only. */
export function AdminsSection({
  initialAdmins,
  myAdminRole,
}: {
  initialAdmins: AdminRecord[];
  myAdminRole: AdminRole;
}) {
  const [admins, setAdmins] = useState<AdminRecord[]>(initialAdmins);
  const [grantState, grantFormAction, isGrantPending] = useActionState(grantAdminAction, null);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);

  const refreshAdmins = () => {
    listAdminsAction().then(setAdmins);
  };

  useEffect(() => {
    if (grantState?.success) refreshAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot refresh on successful grant
  }, [grantState]);

  const handleRevoke = async (email: string) => {
    setRevokingEmail(email);
    const result = await revokeAdminAction(email);
    setRevokingEmail(null);
    setRevokeMessage(result?.success ? result.message : result?.error ?? null);
    refreshAdmins();
  };

  const isSuperAdmin = myAdminRole === "super_admin";

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy">Admins</h2>
      <p className="mt-1 text-gray-600">
        {isSuperAdmin
          ? "Grant or revoke admin access. Only a super admin can do this."
          : "Admin access is granted by a super admin — you can view the list below but can't change it."}
      </p>

      {isSuperAdmin && (
        <form action={grantFormAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input id="grant-admin-email" name="email" type="email" label="Email to grant admin access" required />
          </div>
          <Button type="submit" disabled={isGrantPending} className="self-start px-4 py-2 text-sm">
            {isGrantPending ? "Granting..." : "Grant admin"}
          </Button>
        </form>
      )}
      {grantState?.success && <p className="mt-2 text-sm text-green-700">✅ {grantState.message}</p>}
      {grantState?.success === false && <p className="mt-2 text-sm text-red-600">❌ {grantState.error}</p>}
      {revokeMessage && <p className="mt-2 text-sm text-gray-600">{revokeMessage}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {admins.map((admin) => (
          <Card key={admin.email} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-brand-navy break-all">{admin.email}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                </p>
              </div>
              {isSuperAdmin && admin.role !== "super_admin" && (
                <button
                  type="button"
                  onClick={() => handleRevoke(admin.email)}
                  disabled={revokingEmail === admin.email}
                  className="shrink-0 text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  {revokingEmail === admin.email ? "Revoking..." : "Revoke"}
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
