import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { useTransactions, type Txn } from "@/lib/data";
import { hiDate, monthKey, monthLabel, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Excel Download – Expense Tracker" },
      {
        name: "description",
        content: "Download your expense data as Excel by month, date range or selected categories.",
      },
      { property: "og:title", content: "Excel Download – Expense Tracker" },
      { property: "og:description", content: "Export your full expense data to an Excel file." },
    ],
  }),
  component: ExportPage,
});

function rows(list: Txn[]) {
  return list.map((t) => ({
    Date: hiDate(t.date),
    Type: t.type === "expense" ? "Expense" : "Funding",
    Category: t.category,
    Amount: Number(t.amount),
    Description: t.description ?? "",
    Source: t.source === "attendance" ? "Attendance DA" : "Manual",
  }));
}

function monthlySummary(list: Txn[]) {
  const map = new Map<string, { expense: number; income: number }>();
  list.forEach((t) => {
    const k = monthKey(t.date);
    const cur = map.get(k) ?? { expense: 0, income: 0 };
    if (t.type === "expense") cur.expense += Number(t.amount);
    else cur.income += Number(t.amount);
    map.set(k, cur);
  });
  return [...map.entries()].sort().map(([k, v]) => ({
    Month: monthLabel(k),
    Expense: v.expense,
    Funding: v.income,
    Balance: v.income - v.expense,
  }));
}

function categorySummary(list: Txn[]) {
  const map = new Map<string, { expense: number; income: number; count: number }>();
  list.forEach((t) => {
    const cur = map.get(t.category) ?? { expense: 0, income: 0, count: 0 };
    if (t.type === "expense") cur.expense += Number(t.amount);
    else cur.income += Number(t.amount);
    cur.count += 1;
    map.set(t.category, cur);
  });
  return [...map.entries()].map(([k, v]) => ({
    Category: k,
    Expense: v.expense,
    Funding: v.income,
    Net: v.income - v.expense,
    Entries: v.count,
  }));
}

function download(sheets: { name: string; data: Record<string, unknown>[] }[], file: string) {
  if (sheets.every((s) => s.data.length === 0)) {
    toast.error("No data to download!");
    return;
  }
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.data), s.name));
  XLSX.writeFile(wb, file);
  toast.success("Download started!");
}

function ExportPage() {
  const { data: txns = [] } = useTransactions();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [selected, setSelected] = useState<string[]>([]);
  const [catFrom, setCatFrom] = useState("");
  const [catTo, setCatTo] = useState("");

  const monthTxns = txns.filter((t) => monthKey(t.date) === month);
  const rangeTxns = txns.filter((t) => t.date >= from && t.date <= to);

  const allCategories = useMemo(
    () => [...new Set(txns.map((t) => t.category))].sort(),
    [txns],
  );

  const categoryTxns = txns.filter(
    (t) =>
      selected.includes(t.category) &&
      (!catFrom || t.date >= catFrom) &&
      (!catTo || t.date <= catTo),
  );

  const toggle = (cat: string) =>
    setSelected((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  return (
    <AppShell title="📥 Excel Download">
      <div className="surface space-y-3 p-4">
        <h2 className="text-base font-semibold">📅 By month</h2>
        <div className="space-y-1.5">
          <Label htmlFor="month">Select month</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{monthTxns.length} transactions found</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() =>
              download([{ name: "Transactions", data: rows(monthTxns) }], `transactions-${month}.xlsx`)
            }
          >
            Download transactions
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download(
                [{ name: "Category Summary", data: categorySummary(monthTxns) }],
                `summary-${month}.xlsx`,
              )
            }
          >
            Download summary
          </Button>
        </div>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">📆 By date range</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ef">From</Label>
            <Input id="ef" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et">To</Label>
            <Input id="et" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{rangeTxns.length} transactions found</p>
        <Button
          className="w-full"
          onClick={() =>
            download([{ name: "Transactions", data: rows(rangeTxns) }], `transactions-${from}_${to}.xlsx`)
          }
        >
          Download range
        </Button>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">🏷️ By category</h2>
        {allCategories.length === 0 && (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}
        {allCategories.length > 0 && (
          <>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(allCategories)}>
                Select all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
              {allCategories.map((cat) => (
                <label key={cat} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={selected.includes(cat)} onCheckedChange={() => toggle(cat)} />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf">From (optional)</Label>
                <Input
                  id="cf"
                  type="date"
                  value={catFrom}
                  onChange={(e) => setCatFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct">To (optional)</Label>
                <Input id="ct" type="date" value={catTo} onChange={(e) => setCatTo(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.length} categories selected • {categoryTxns.length} transactions
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() => {
                  if (selected.length === 0) {
                    toast.error("Select at least one category!");
                    return;
                  }
                  download(
                    [{ name: "Transactions", data: rows(categoryTxns) }],
                    "transactions-categories.xlsx",
                  );
                }}
              >
                Download selected
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (selected.length === 0) {
                    toast.error("Select at least one category!");
                    return;
                  }
                  download(
                    [
                      { name: "Transactions", data: rows(categoryTxns) },
                      { name: "Category Summary", data: categorySummary(categoryTxns) },
                    ],
                    "categories-with-summary.xlsx",
                  );
                }}
              >
                With summary
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">📚 All data</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            onClick={() =>
              download(
                [
                  { name: "Transactions", data: rows(txns) },
                  { name: "Monthly Summary", data: monthlySummary(txns) },
                  { name: "Category Summary", data: categorySummary(txns) },
                ],
                "expense-tracker-all.xlsx",
              )
            }
          >
            All sheets (one file)
          </Button>
          <Button
            variant="secondary"
            onClick={() => download([{ name: "Transactions", data: rows(txns) }], "transactions.xlsx")}
          >
            Transactions only
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download([{ name: "Monthly Summary", data: monthlySummary(txns) }], "monthly.xlsx")
            }
          >
            Monthly summary
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download([{ name: "Category Summary", data: categorySummary(txns) }], "category.xlsx")
            }
          >
            Category summary
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
