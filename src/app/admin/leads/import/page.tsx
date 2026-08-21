import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { importLeadsAction } from "@/app/actions/leadsActions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function ImportLeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-brand-navy">Import leads</h1>
      <p className="mt-1 text-gray-600">
        Paste CSV data — the shape produced by the county classification scripts in
        <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-sm">private-notes/marketing/</code>
        (headers: Company Name, EPA Handler ID, Generator Status, City, County, Category, Contact Name, Contact
        Title, Phone, Email, E-Manifest Experience, Manifests Since 2023). Re-importing the same EPA Handler ID
        updates the existing row instead of duplicating it.
      </p>

      <Card className="mt-6 p-6">
        <form action={importLeadsAction} className="flex flex-col gap-4">
          <textarea
            name="csv"
            required
            rows={16}
            placeholder="Company Name,EPA Handler ID,Generator Status,..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <div className="flex justify-end gap-3">
            <Button href="/admin/leads" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Import</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
