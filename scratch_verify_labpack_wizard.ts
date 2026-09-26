/**
 * Standalone verification script (not a permanent test suite -- this repo
 * has no test runner configured yet) for packingRules.ts's TS port.
 * Run with: npx tsx scratch_verify_labpack_wizard.ts
 */
import {
  shippingName,
  NON_DOT_NON_RCRA_NAME,
  groupIntoDrums,
  type CharacterizedWizardItem,
} from "./src/lib/labPack/packingRules";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

// --- shippingName() ---
check(
  "shippingName: normal Class 3 drum with codes",
  shippingName("Hazardous Waste, Liquid, N.O.S. (Methanol, Acetone), 3, UN1993, PG II", false, true),
  "UN1993, Waste Liquids, NOS (Methanol, Acetone), PGII"
);

check(
  "shippingName: RQ + no-waste-code omits 'Waste'",
  shippingName("Hazardous Waste, Liquid, Toxic, N.O.S. (Dichloromethane), 6.1, UN1593, PG III", true, false),
  "UN1593, RQ, Liquids, Toxic, NOS (Dichloromethane), PGIII"
);

check(
  "shippingName: fixed non-DOT/non-RCRA string passes through verbatim",
  shippingName("Non DOT, Non RCRA Regulated Materials,none,n/a,n/a"),
  NON_DOT_NON_RCRA_NAME
);

check(
  "shippingName: fixed string still recognized with a bracketed VERIFY annotation",
  shippingName("Non DOT, Non RCRA Regulated Materials,none,n/a,n/a [VERIFY entire DOT/RCRA determination]"),
  NON_DOT_NON_RCRA_NAME
);

// --- groupIntoDrums() ---
const fixture: CharacterizedWizardItem[] = [
  {
    id: "1",
    chemicalName: "Acetone",
    quantity: null,
    containerSize: "4 L",
    physicalState: "liquid",
    epaWasteCodes: ["F003"],
    sourceLocation: "",
    notes: "",
    hazardClass: "3",
  },
  {
    id: "2",
    chemicalName: "Iodine crystals",
    quantity: null,
    containerSize: "1 pt",
    physicalState: "solid",
    epaWasteCodes: [], // non-RCRA
    sourceLocation: "",
    notes: "",
    hazardClass: "8",
    isDotRegulated: true,
  },
  {
    id: "3",
    chemicalName: "Methyl salicylate",
    quantity: null,
    containerSize: "500 mL",
    physicalState: "liquid",
    epaWasteCodes: [], // non-RCRA, organic
    sourceLocation: "",
    notes: "",
    hazardClass: "6.1",
    isDotRegulated: false,
  },
  {
    id: "4",
    chemicalName: "Potassium permanganate",
    quantity: null,
    containerSize: "1 L",
    physicalState: "solid",
    epaWasteCodes: [],
    sourceLocation: "",
    notes: "",
    hazardClass: "5.1", // oxidizer -- must always get its own drum
  },
];

const drums = groupIntoDrums(fixture);
console.log(`\ngroupIntoDrums produced ${drums.length} drums:`);
for (const d of drums) {
  console.log(`  Drum ${d.drumNumber} [${d.category}] nonHaz=${d.isNonHazardous} codes=${d.wasteCodes.join(",")} items=${d.items.map((i) => i.chemicalName).join(", ")}`);
}

check("groupIntoDrums: produces 4 drums (one per item, none compatible enough to share)", drums.length, 4);

const oxidizerDrum = drums.find((d) => d.items.some((i) => i.chemicalName === "Potassium permanganate"));
check("groupIntoDrums: 5.1 oxidizer gets its own hard-segregated drum", oxidizerDrum?.items.length, 1);
check("groupIntoDrums: 5.1 oxidizer drum category is hard_segregated", oxidizerDrum?.category, "hard_segregated");

const acetoneDrum = drums.find((d) => d.items.some((i) => i.chemicalName === "Acetone"));
check("groupIntoDrums: Acetone (F003) is hazardous, not non-hazardous", acetoneDrum?.isNonHazardous, false);
check("groupIntoDrums: Acetone drum aggregates F003", acetoneDrum?.wasteCodes, ["F003"]);

const iodineDrum = drums.find((d) => d.items.some((i) => i.chemicalName === "Iodine crystals"));
check("groupIntoDrums: Iodine (non-RCRA) is flagged non-hazardous", iodineDrum?.isNonHazardous, true);
check("groupIntoDrums: Iodine suggested category is inorganic_acid", iodineDrum?.category, "inorganic_acid");

const salicylateDrum = drums.find((d) => d.items.some((i) => i.chemicalName === "Methyl salicylate"));
check("groupIntoDrums: Methyl salicylate suggested category is toxic_organic_pg2_3", salicylateDrum?.category, "toxic_organic_pg2_3");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
