export const DEFAULT_CATEGORIES = {
  expense: [
    "🍔 Supervisor D/A",
    "👨‍💼 Promoter D/A",
    "🏨 Hotel",
    "🚗 Auto",
    "🚌 Bus",
    "📄 Photo Copy",
    "💸 Other Expense",
    "📱 Recharge",
    "🏦 Bank Charge",
    "🛣️ Toll",
    "👮 Police",
    "💼 Kuli",
  ],
  funding: ["💰 Funding", "💼 Salary", "📈 Business", "🎁 Bonus"],
} as const;

export const STAFF_ROLES = [
  { value: "Supervisor", label: "Supervisor", category: "🍔 Supervisor D/A" },
  { value: "Promoter", label: "Promoter", category: "👨‍💼 Promoter D/A" },
  { value: "Other", label: "अन्य", category: "💸 Other Expense" },
] as const;

export function categoryForRole(role: string) {
  return STAFF_ROLES.find((r) => r.value === role)?.category ?? "💸 Other Expense";
}
