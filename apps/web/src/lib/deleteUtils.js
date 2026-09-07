/**
 * deleteUtils.js
 * Comprehensive deletion helpers for the land registry system.
 */
import pb from "@/lib/pocketbaseClient";

/**
 * Delete every record in a collection that matches a filter.
 * Silently ignores collection-not-found and empty-result errors.
 */
async function deleteWhere(collectionName, filter, batchKey) {
  try {
    const items = await pb.collection(collectionName).getFullList({
      filter,
      requestKey: `del-${batchKey}-${Math.random().toString(36).slice(2)}`,
    });
    for (const item of items) {
      await pb.collection(collectionName).delete(item.id);
    }
    return items.length;
  } catch (_) {
    return 0;
  }
}

/**
 * Permanently delete a parcel and ALL data referencing it:
 *  - documents, payments, surveys, land_transfers, land_edit_requests, applications
 *  - audit_logs entries whose entity === parcelId
 *  - notifications that mention the parcelNumber
 *  - soft-delete audit markers (so import no longer sees it as existing)
 *
 * Returns a summary { deleted, errors }
 */
export async function deleteParcelCompletely(parcelId, parcelNumber) {
  const errors = [];
  let deleted = 0;

  const related = [
    ["documents",         `parcel = "${parcelId}"`],
    ["payments",          `parcel = "${parcelId}"`],
    ["surveys",           `parcel = "${parcelId}"`],
    ["land_transfers",    `parcel = "${parcelId}"`],
    ["land_edit_requests",`parcel = "${parcelId}"`],
    ["applications",      `parcel = "${parcelId}"`],
  ];

  for (const [col, filter] of related) {
    try {
      deleted += await deleteWhere(col, filter, `${col}-${parcelId}`);
    } catch (err) {
      errors.push(`${col}: ${err?.message}`);
    }
  }

  // Delete audit_log entries that reference this parcel id as entity
  try {
    deleted += await deleteWhere("audit_logs", `entity = "${parcelId}"`, `audit-${parcelId}`);
  } catch (err) {
    errors.push(`audit_logs: ${err?.message}`);
  }

  // Delete notifications that mention the parcel number or id
  if (parcelNumber) {
    try {
      const notifs = await pb.collection("notifications").getFullList({
        requestKey: `del-notifs-${parcelId}-${Math.random().toString(36).slice(2)}`,
      });
      for (const n of notifs) {
        const msg = n.message || "";
        const link = n.link || "";
        if (msg.includes(parcelNumber) || msg.includes(parcelId) || link.includes(parcelId)) {
          try { await pb.collection("notifications").delete(n.id); deleted++; } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Finally delete the parcel itself
  try {
    await pb.collection("parcels").delete(parcelId);
    deleted++;
  } catch (err) {
    errors.push(`parcels: ${err?.message}`);
  }

  return { deleted, errors };
}

/**
 * Check if a parcel is currently soft-deleted by examining audit_logs.
 * Returns true if the last relevant action for this parcel is "parcel_soft_deleted".
 */
export async function isParcelSoftDeleted(parcelId) {
  try {
    const entries = await pb.collection("audit_logs").getFullList({
      filter: pb.filter(
        `entity = {:id} && (action = "parcel_soft_deleted" || action = "parcel_restored")`,
        { id: parcelId }
      ),
      sort: "created",
      requestKey: `softdel-chk-${parcelId}-${Math.random().toString(36).slice(2)}`,
    });
    if (!entries.length) return false;
    const last = entries[entries.length - 1];
    return last.action === "parcel_soft_deleted";
  } catch (_) {
    return false;
  }
}
