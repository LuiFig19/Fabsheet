// Real Raven's Marine reference data. Seeded exactly as printed on the form.

export const LABOR_CODES: { code: string; description: string }[] = [
  { code: "110", description: "Weld/Fab" },
  { code: "120", description: "Cut" },
  { code: "125", description: "Cut for Stock" },
  { code: "130", description: "Repair/Reworking" },
  { code: "140", description: "Labor Decking" },
  { code: "150", description: "Floats" },
  { code: "160", description: "Bumper" },
  { code: "170", description: "Helping Welder (must put WO#)" },
  { code: "180", description: "Special Projects" },
  { code: "210", description: "Shipping Prep" },
  { code: "220", description: "Wash" },
  { code: "230", description: "Load/Unload Trucks" },
  { code: "240", description: "Welding Machine Repair" },
  { code: "250", description: "Admin" },
  { code: "260", description: "Maintenance" },
  { code: "270", description: "Inventory" },
  { code: "280", description: "Fit-Up/Install" },
];

// "110 Weld/Fab" style labels for dropdowns.
export const LABOR_CODE_OPTIONS = LABOR_CODES.map((c) => `${c.code} ${c.description}`);

export const TASK_DESCRIPTIONS = [
  "Frame",
  "Decking",
  "Rails",
  "ADA",
  "Tread Plate",
  "5th W",
  "Splice",
  "Pickets",
  "Mesh",
];

export const EMPLOYEES = [
  "Luis Figueroa",
  "Glenn Swinger",
  "Tyler Paulsen",
  "Luis Sanchez",
  "Jose Davila",
  "Davian Soto",
  "Stanley Humphrey",
  "Chris Sharpe",
  "Raul",
  "Carlos Felici",
  "Jordan M",
  "Jaquane Mosley",
  "Scott Oliver",
];

// Real customers plus a few placeholders with budgets so the dashboard shows
// the green/yellow/red tiers out of the box.
export const JOBS: {
  workOrderNumber: string;
  customerName: string;
  description: string;
  budgetedHours: number;
  status?: string;
}[] = [
  { workOrderNumber: "4354", customerName: "RCCL RB1", description: "Royal Caribbean RB1", budgetedHours: 400 },
  { workOrderNumber: "4571", customerName: "RCCL Coco Cay", description: "Royal Caribbean Coco Cay", budgetedHours: 320 },
  { workOrderNumber: "4602", customerName: "Marine Dock Co", description: "Aluminum gangway", budgetedHours: 120 },
  { workOrderNumber: "4610", customerName: "Bayfront Marina", description: "Floating dock rails", budgetedHours: 80 },
  { workOrderNumber: "4625", customerName: "Port Everglades", description: "Tread plate stairs", budgetedHours: 60 },
];
