"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import {
  listCustomWasteCodesAction,
  deleteCustomWasteCodeAction,
  saveCustomWasteCodeAction,
  updateCustomWasteCodeAction,
} from "@/app/actions/customWasteCodeActions";
import type { CustomWasteCode } from "@/services/customWasteCodeRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function codesLine(entry: CustomWasteCode): string {
  const all = [...entry.dCodes, ...entry.fCodes, ...entry.pCodes, ...entry.uCodes];
  return all.length > 0 ? all.join(", ") : "No codes saved";
}

function AddChemicalForm({ onAdded }: { onAdded: () => void }) {
  const [chemicalName, setChemicalName] = useState("");
  const [wasteCodesText, setWasteCodesText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    const result = await saveCustomWasteCodeAction(chemicalName, wasteCodesText, notes);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setChemicalName("");
    setWasteCodesText("");
    setNotes("");
    onAdded();
  };

  return (
    <Card className="mb-6 p-6">
      <p className="mb-3 text-sm font-semibold text-brand-navy">Add a chemical directly</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Chemical name"
          placeholder="e.g. Spent xylene"
          value={chemicalName}
          onChange={(e) => setChemicalName(e.target.value)}
        />
        <Input
          label="RCRA waste code(s)"
          placeholder="D001, F003"
          value={wasteCodesText}
          onChange={(e) => setWasteCodesText(e.target.value)}
        />
        <Input label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={handleAdd} disabled={saving || !chemicalName.trim()} className="mt-3 px-4 py-2 text-sm">
        {saving ? "Adding…" : "+ Add chemical"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function EditableRow({
  entry,
  onDone,
}: {
  entry: CustomWasteCode;
  onDone: () => void;
}) {
  const [wasteCodesText, setWasteCodesText] = useState(codesLine(entry).replace("No codes saved", ""));
  const [notes, setNotes] = useState(entry.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateCustomWasteCodeAction(entry.id, wasteCodesText, notes);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="py-2 pr-3 font-medium text-brand-navy">{entry.chemicalName}</td>
      <td className="py-2 pr-3">
        <input
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          value={wasteCodesText}
          onChange={(e) => setWasteCodesText(e.target.value)}
          placeholder="D001, F003"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <button type="button" onClick={handleSave} disabled={saving} className="mr-3 font-medium text-brand-blue disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} disabled={saving} className="font-medium text-gray-500">
          Cancel
        </button>
      </td>
    </tr>
  );
}

export default function ChemicalLibraryPage() {
  const [entries, setEntries] = useState<CustomWasteCode[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => {
    listCustomWasteCodesAction().then(setEntries);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string, chemicalName: string) => {
    if (!confirm(`Remove "${chemicalName}" from your chemical library? This can't be undone.`)) return;
    setDeletingId(id);
    await deleteCustomWasteCodeAction(id);
    setDeletingId(null);
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Your chemical library</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Chemicals saved from lab pack quick-add searches (automatically, the first time EPA/PubChem
            resolves a query) plus anything you add here directly — private to your account. Saved
            entries match instantly the next time you search that chemical name, without another
            EPA/PubChem lookup.
          </p>
        </div>
        <BackButton fallbackHref="/lab-packs" label="← Back to lab packs" className="whitespace-nowrap text-sm font-medium hover:underline" />
      </div>

      <AddChemicalForm onAdded={refresh} />

      {entries === null && <p className="text-sm text-gray-500">Loading your chemical library…</p>}

      {entries !== null && entries.length === 0 && (
        <Card className="p-6 text-sm text-gray-600">
          Nothing saved yet. Add one above, or search a chemical in the lab pack quick-add form —
          it&apos;ll be saved here automatically.
        </Card>
      )}

      {entries !== null && entries.length > 0 && (
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Chemical name</th>
                <th className="py-1.5 pr-3 font-medium">RCRA codes</th>
                <th className="py-1.5 pr-3 font-medium">Notes</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                editingId === entry.id ? (
                  <EditableRow
                    key={entry.id}
                    entry={entry}
                    onDone={() => {
                      setEditingId(null);
                      refresh();
                    }}
                  />
                ) : (
                  <tr key={entry.id} className="border-t border-gray-100 align-top">
                    <td className="py-2 pr-3 font-medium text-brand-navy">{entry.chemicalName}</td>
                    <td className="py-2 pr-3 text-gray-700">{codesLine(entry)}</td>
                    <td className="py-2 pr-3 text-gray-600">{entry.notes || "—"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingId(entry.id)}
                        className="mr-3 font-medium text-brand-blue"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id, entry.chemicalName)}
                        disabled={deletingId === entry.id}
                        className="font-medium text-red-600 disabled:opacity-50"
                      >
                        {deletingId === entry.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
