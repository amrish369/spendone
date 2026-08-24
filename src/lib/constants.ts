export const DEFAULT_CATEGORIES = {
  expense: [
    "🍔 Daily Allowance",
    "🏨 Hotel",
    "🚗 Auto",
    "🚌 Bus",
    "📄 Photo Copy",
    "💸 Other Expense",
    "📱 Recharge",
    "🏦 Bank Charge",
    "🛣️ Toll",
    "👮 Police",
    "💼 Labour",
  ],
  funding: ["💰 Funding", "💼 Salary", "📈 Business", "🎁 Bonus"],
} as const;

export const STAFF_ROLES = [
  { value: "Staff", label: "Staff", category: "🍔 Daily Allowance" },
  { value: "Other", label: "Other", category: "💸 Other Expense" },
] as const;

export function categoryForRole(role: string) {
  return STAFF_ROLES.find((r) => r.value === role)?.category ?? "🍔 Daily Allowance";
}
