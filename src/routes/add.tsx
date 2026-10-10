import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useTransactions, currentUserId, type Txn } from "@/lib/data";
import { saveTransactionOffline } from "@/lib/offline";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/add")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  head: () => ({
    meta: [
      { title: "Add Transaction – Expense Tracker" },
      { name: "description", content: "Add a new expense or funding entry and manage your categories." },
      { property: "og:title", content: "Add Transaction – Expense Tracker" },
      { property: "og:description", content: "Create a new expense or funding entry." },
    ],
  }),
  component: AddPage,
});

function AddPage() {
  const navigate = useNavigate();
  const { edit } = useSearch({ from: "/add" });
  const qc = useQueryClient();
  const { data: txns = [] } = useTransactions();
  const { data: customCats = [] } = useCategories();

  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!edit) return;
    const t = txns.find((x) => x.id === edit);
    if (t) {
      setDate(t.date);
      setCategory(t.category);
      setAmount(String(t.amount));
      setDescription(t.description ?? "");
    }
  }, [edit, txns]);

  const save = async (type: "expense" | "funding") => {
    if (!category || !amount) {
      toast.error("Category and amount are required!");
      return;
    }
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const payload = {
        ...(edit ? { id: edit } : {}),
        user_id,
        date,
        category,
        amount: Number(amount),
        description: description || null,
        type,
      };
      const result = await saveTransactionOffline(payload, Boolean(edit));
      qc.setQueryData<Txn[]>(["transactions"], (current = []) => {
        const next = result.row as Txn;
        return edit
          ? current.map((transaction) => (transaction.id === edit ? { ...transaction, ...next } : transaction))
          : [next, ...current];
      });
      if (result.queued) toast.success("Saved on this device. It will sync when you’re online.");
      else {
        toast.success(edit ? "Updated!" : "Added!");
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
      if (edit) navigate({ to: "/len-den" });
      else {
        setAmount("");
        setDescription("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const isEditingFunding = edit
    ? txns.find((t) => t.id === edit)?.type === "funding"
    : false;

  return (
    <AppShell title={edit ? "✏️ Edit transaction" : "➕ Add transaction"}>
      <div className="surface space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Category</Label>
            <CategoryManager />
          </div>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a category</option>
            <optgroup label="💰 Default expenses">
              {DEFAULT_CATEGORIES.expense.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            {customCats.filter((c) => c.type === "expense").length > 0 && (
              <optgroup label="⭐ Custom expenses">
                {customCats
                  .filter((c) => c.type === "expense")
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="💵 Default funding">
              {DEFAULT_CATEGORIES.funding.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            {customCats.filter((c) => c.type === "funding").length > 0 && (
              <optgroup label="⭐ Custom funding">
                {customCats
                  .filter((c) => c.type === "funding")
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description (optional)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Write a description..."
            rows={2}
          />
        </div>

        {edit ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              disabled={busy}
              onClick={() => save(isEditingFunding ? "funding" : "expense")}
            >
              Update
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/len-den" })}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={busy} variant="destructive" onClick={() => save("expense")}>
              💸 Add expense
            </Button>
            <Button
              disabled={busy}
              onClick={() => save("funding")}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              💰 Add funding
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryManager() {
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories();
  const [type, setType] = useState<"expense" | "funding">("expense");
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("categories")
      .insert({ name: name.trim(), type, user_id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    qc.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Category added!");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          🏷️ Manage categories
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={type === "expense" ? "default" : "outline"}
            onClick={() => setType("expense")}
          >
            Expense
          </Button>
          <Button
            variant={type === "funding" ? "default" : "outline"}
            onClick={() => setType("funding")}
          >
            Funding
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
          />
          <Button onClick={add}>Add</Button>
        </div>
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {cats.filter((c) => c.type === type).length === 0 && (
            <p className="text-sm text-muted-foreground">No custom categories.</p>
          )}
          {cats
            .filter((c) => c.type === type)
            .map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm">{c.name}</span>
                <button onClick={() => remove(c.id)} aria-label="Delete">
                  <Trash2 className="size-4 text-destructive" />
                </button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
