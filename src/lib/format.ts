export const money = (n: number) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const todayISO = () => new Date().toISOString().split("T")[0]!;

export const hiDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${(y ?? "").slice(2)}`;
};

/** Strips leading emoji from a category label. */
export const cleanCategory = (c: string) =>
  (c || "").replace(/[\p{Extended_Pictographic}\u200d\uFE0F]/gu, "").trim();

export const monthKey = (iso: string) => (iso || "").slice(0, 7);

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const names = [
    "जनवरी",
    "फ़रवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
};
