import type { WasteCategory } from "@/services/wasteProfileRepository";

// Shared between the profiles dashboard (list card borders) and
// WasteProfileFormFields (category picker + badge coloring) -- split into
// its own module so both can import it without one depending on the other.
export const WASTE_CATEGORY_OPTIONS: { value: WasteCategory; label: string; hint: string }[] = [
  { value: "hazardous", label: "Hazardous Waste", hint: "Full RCRA-regulated hazardous waste — travels on an e-Manifest." },
  { value: "non_hazardous", label: "Non-Hazardous Waste", hint: "Not RCRA-regulated — can ship on a Bill of Lading instead." },
  { value: "universal", label: "Universal Waste", hint: "Batteries, lamps, pesticides, mercury devices (40 CFR 273) — reduced requirements, not a full manifest." },
];

// Card border color keyed to waste_category, so a profile's regulatory
// category is visible at a glance in the list without reading the text.
export const WASTE_CATEGORY_BORDER: Record<WasteCategory, string> = {
  hazardous: "border-2 border-yellow-400",
  non_hazardous: "border-2 border-blue-400",
  universal: "border-2 border-purple-900",
};
