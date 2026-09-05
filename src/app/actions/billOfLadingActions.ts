"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createBillOfLading,
  getBillOfLading,
  getBillOfLadingByNumber,
  listRecentBillsOfLading,
  type BillOfLading,
  type BillOfLadingInput,
  type RecentBillOfLading,
} from "@/services/billOfLadingRepository";

export type CreateBillOfLadingState =
  | { success: true; billOfLading: BillOfLading }
  | { success: false; error: string };

export async function createBillOfLadingAction(input: BillOfLadingInput): Promise<CreateBillOfLadingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  if (!input.shipperName.trim()) return { success: false, error: "Shipper name is required." };
  if (!input.consigneeName.trim()) return { success: false, error: "Consignee name is required." };
  if (input.lines.length === 0) return { success: false, error: "Add at least one line item." };

  return createBillOfLading(supabase, user.id, input);
}

export async function getBillOfLadingAction(id: string): Promise<CreateBillOfLadingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  return getBillOfLading(supabase, user.id, id);
}

export async function lookupBillOfLadingByNumberAction(bolNumber: string): Promise<CreateBillOfLadingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  return getBillOfLadingByNumber(supabase, user.id, bolNumber);
}

export async function listRecentBillsOfLadingAction(): Promise<RecentBillOfLading[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return listRecentBillsOfLading(supabase, user.id);
}
