import { del, get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

type OfflineTransaction = {
  id?: string;
  user_id: string;
  date: string;
  type: "expense" | "funding";
  category: string;
  amount: number;
  description: string | null;
  source?: string;
  attendance_id?: string | null;
};

type OfflineAttendance = {
  id: string;
  user_id: string;
  staff_id: string;
  date: string;
  status: "present" | "traveling" | "absent";
  da_amount: number;
};

type PendingChange = {
  id: string;
  userId: string;
  kind: "transaction-insert" | "transaction-update" | "attendance-save" | "attendance-delete";
  payload: Record<string, unknown>;
};

const queueKey = (userId: string) => `spendone:pending:${userId}`;
const cacheKey = (userId: string, queryKey: string) => `spendone:data:${userId}:${queryKey}`;
const changeEvent = "spendone-offline-change";

function announceChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(changeEvent));
}

function isNetworkError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /network|fetch|offline|connection|load failed|timeout/.test(message);
}

async function localUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? "";
}

async function enqueue(change: PendingChange) {
  const key = queueKey(change.userId);
  const changes = (await get<PendingChange[]>(key)) ?? [];
  const withoutDuplicate = changes.filter((item) => item.id !== change.id);
  await set(key, [...withoutDuplicate, change]);
  announceChange();
}

export async function cachedQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const userId = await localUserId();
  try {
    const result = await fetcher();
    if (userId) await set(cacheKey(userId, key), result);
    return result;
  } catch (error) {
    if (userId) {
      const cached = await get<T>(cacheKey(userId, key));
      if (cached !== undefined) return cached;
    }
    throw error;
  }
}

export async function pendingCount(userId: string) {
  if (!userId) return 0;
  const changes = (await get<PendingChange[]>(queueKey(userId))) ?? [];
  return changes.length;
}

export async function saveTransactionOffline(transaction: OfflineTransaction, update = false) {
  const id = transaction.id ?? crypto.randomUUID();
  const row = { ...transaction, id, source: transaction.source ?? "manual" };
  const change: PendingChange = {
    id: update ? `transaction-update:${id}` : `transaction-insert:${id}`,
    userId: transaction.user_id,
    kind: update ? "transaction-update" : "transaction-insert",
    payload: row,
  };

  if (navigator.onLine) {
    try {
      if (update) {
        const { error } = await supabase.from("transactions").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").upsert(row, { onConflict: "id" });
        if (error) throw error;
      }
      return { row, queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue(change);
  return { row, queued: true };
}

export async function saveAttendanceOffline(input: {
  userId: string;
  staffId: string;
  staffName: string;
  date: string;
  status: OfflineAttendance["status"];
  daAmount: number;
  existingId?: string;
}) {
  const attendance: OfflineAttendance = {
    id: input.existingId ?? crypto.randomUUID(),
    user_id: input.userId,
    staff_id: input.staffId,
    date: input.date,
    status: input.status,
    da_amount: input.daAmount,
  };
  const daTransactionId = crypto.randomUUID();
  const payload = {
    attendance,
    staffName: input.staffName,
    daTransactionId,
  };
  const transaction =
    input.status !== "absent" && input.daAmount > 0
      ? {
          id: daTransactionId,
          user_id: input.userId,
          date: input.date,
          type: "expense" as const,
          category: input.staffName,
          amount: input.daAmount,
          description: null,
          source: "attendance",
          attendance_id: attendance.id,
        }
      : null;

  if (navigator.onLine) {
    try {
      const { data: saved, error } = await supabase
        .from("attendance")
        .upsert(attendance, { onConflict: "staff_id,date" })
        .select()
        .single();
      if (error) throw error;
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("attendance_id", saved.id);
      if (deleteError) throw deleteError;
      if (input.status !== "absent" && input.daAmount > 0) {
        const { error: transactionError } = await supabase.from("transactions").upsert(
          {
            id: daTransactionId,
            user_id: input.userId,
            date: input.date,
            type: "expense",
            category: input.staffName,
            amount: input.daAmount,
            description: null,
            source: "attendance",
            attendance_id: saved.id,
          },
          { onConflict: "id" },
        );
        if (transactionError) throw transactionError;
      }
      return { attendance: saved as OfflineAttendance, transaction, queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({
    id: `attendance-save:${input.staffId}:${input.date}`,
    userId: input.userId,
    kind: "attendance-save",
    payload,
  });
  return { attendance, transaction, queued: true };
}

export async function deleteAttendanceOffline(userId: string, attendanceId: string) {
  if (navigator.onLine) {
    try {
      const { error: transactionError } = await supabase
        .from("transactions")
        .delete()
        .eq("attendance_id", attendanceId);
      if (transactionError) throw transactionError;
      const { error } = await supabase.from("attendance").delete().eq("id", attendanceId);
      if (error) throw error;
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({
    id: `attendance-delete:${attendanceId}`,
    userId,
    kind: "attendance-delete",
    payload: { attendanceId },
  });
  return { queued: true };
}

async function applyPendingChange(change: PendingChange) {
  if (change.kind === "transaction-insert") {
    const { error } = await supabase
      .from("transactions")
      .upsert(change.payload, { onConflict: "id" });
    if (error) throw error;
    return;
  }
  if (change.kind === "transaction-update") {
    const { id, ...updates } = change.payload;
    const { error } = await supabase.from("transactions").update(updates).eq("id", String(id));
    if (error) throw error;
    return;
  }
  if (change.kind === "attendance-delete") {
    const attendanceId = String(change.payload.attendanceId);
    const { error: transactionError } = await supabase
      .from("transactions")
      .delete()
      .eq("attendance_id", attendanceId);
    if (transactionError) throw transactionError;
    const { error } = await supabase.from("attendance").delete().eq("id", attendanceId);
    if (error) throw error;
    return;
  }

  const payload = change.payload as unknown as {
    attendance: OfflineAttendance;
    staffName: string;
    daTransactionId: string;
  };
  const { data: saved, error } = await supabase
    .from("attendance")
    .upsert(payload.attendance, { onConflict: "staff_id,date" })
    .select()
    .single();
  if (error) throw error;
  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("attendance_id", saved.id);
  if (deleteError) throw deleteError;
  if (payload.attendance.status !== "absent" && payload.attendance.da_amount > 0) {
    const { error: transactionError } = await supabase.from("transactions").upsert(
      {
        id: payload.daTransactionId,
        user_id: payload.attendance.user_id,
        date: payload.attendance.date,
        type: "expense",
        category: payload.staffName,
        amount: payload.attendance.da_amount,
        description: null,
        source: "attendance",
        attendance_id: saved.id,
      },
      { onConflict: "id" },
    );
    if (transactionError) throw transactionError;
  }
}

export async function syncPendingChanges(userId: string) {
  if (!userId || !navigator.onLine) return { synced: 0, remaining: await pendingCount(userId) };
  const key = queueKey(userId);
  const changes = (await get<PendingChange[]>(key)) ?? [];
  let synced = 0;

  for (const change of changes) {
    try {
      await applyPendingChange(change);
      const latest = (await get<PendingChange[]>(key)) ?? [];
      await set(key, latest.filter((item) => item.id !== change.id));
      synced += 1;
      announceChange();
    } catch {
      // Keep changes that could not be sent; the next online retry will try again.
    }
  }

  const remaining = await pendingCount(userId);
  announceChange();
  return { synced, remaining };
}

export async function clearOfflineData(userId: string) {
  if (!userId) return;
  const keys = ["transactions", "categories", "staff", "attendance:all", "work_logs", "work_days", "customers", "ledger:all"];
  await Promise.all(keys.map((key) => del(cacheKey(userId, key))));
}

export const OFFLINE_CHANGE_EVENT = changeEvent;