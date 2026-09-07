import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Red blinking indicator for pending approvals (land edit/delete requests
 * and land transfers awaiting review). Realtime-updated via PocketBase.
 * Shown only for roles that can access the Approvals module (approvers).
 */
export default function ApprovalIndicator() {
  const { role, roles } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const effective = roles.length > 0 ? roles : [role];
  const canSee = effective.some((r) => canAccess(r, "approvals"));

  const [editPending, setEditPending] = useState(0);
  const [transferPending, setTransferPending] = useState(0);
  const knownIds = useRef(new Set());
  const mounted = useRef(false);

  const total = editPending + transferPending;

  // Initial load + realtime subscription to land_edit_requests
  useEffect(() => {
    if (!canSee) return;
    mounted.current = true;

    const loadEdits = async () => {
      try {
        const list = await pb.collection("land_edit_requests").getFullList({
          filter: 'status = "pending"',
          sort: "-created",
          requestKey: "appr-edits",
        });
        if (!mounted.current) return;
        list.forEach((r) => knownIds.current.add(`e:${r.id}`));
        setEditPending(list.length);
      } catch (_) {}
    };

    const loadTransfers = async () => {
      try {
        const list = await pb.collection("land_transfers").getFullList({
          filter: 'status = "pending"',
          sort: "-created",
          requestKey: "appr-transfers",
        });
        if (!mounted.current) return;
        list.forEach((r) => knownIds.current.add(`t:${r.id}`));
        setTransferPending(list.length);
      } catch (_) {}
    };

    loadEdits();
    loadTransfers();

    let unsubEdits, unsubTransfers;
    const subEdits = pb
      .collection("land_edit_requests")
      .subscribe("*", (e) => {
        if (!mounted.current) return;
        const key = `e:${e.record.id}`;
        const isPending = e.record.status === "pending";
        setEditPending((prev) => {
          if (e.action === "delete") return Math.max(0, prev - 1);
          if (e.action === "create" && isPending) {
            if (!knownIds.current.has(key)) {
              knownIds.current.add(key);
              toast({
                title: "New approval request",
                description: `A land ${e.record.type || "edit"} request is awaiting your review.`,
                onClick: () => navigate("/app/approvals"),
              });
              return prev + 1;
            }
            return prev + 1;
          }
          if (e.action === "update") {
            // recompute from scratch to stay accurate on status changes
            return isPending ? prev : Math.max(0, prev - 1);
          }
          return prev;
        });
      })
      .catch(() => {});

    const subTransfers = pb
      .collection("land_transfers")
      .subscribe("*", (e) => {
        if (!mounted.current) return;
        const key = `t:${e.record.id}`;
        const isPending = e.record.status === "pending";
        setTransferPending((prev) => {
          if (e.action === "delete") return Math.max(0, prev - 1);
          if (e.action === "create" && isPending) {
            if (!knownIds.current.has(key)) {
              knownIds.current.add(key);
              toast({
                title: "New land transfer request",
                description: `Transfer to ${e.record.toOwnerName || "a new owner"} is awaiting approval.`,
                onClick: () => navigate("/app/approvals"),
              });
              return prev + 1;
            }
            return prev + 1;
          }
          if (e.action === "update") {
            return isPending ? prev : Math.max(0, prev - 1);
          }
          return prev;
        });
      })
      .catch(() => {});

    Promise.resolve(subEdits).then((fn) => { unsubEdits = fn; });
    Promise.resolve(subTransfers).then((fn) => { unsubTransfers = fn; });

    return () => {
      mounted.current = false;
      try { if (unsubEdits) unsubEdits(); } catch (_) {}
      try { if (unsubTransfers) unsubTransfers(); } catch (_) {}
      void pb.collection("land_edit_requests").unsubscribe("*").catch(() => {});
      void pb.collection("land_transfers").unsubscribe("*").catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee]);

  if (!canSee) return null;

  const handleClick = () => navigate("/app/approvals");

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        total > 0
          ? `${total} pending approval${total !== 1 ? "s" : ""} — ${editPending} edit/delete, ${transferPending} transfer${transferPending !== 1 ? "s" : ""}. Click to review.`
          : "No pending approvals"
      }
      aria-label={`Pending approvals: ${total}`}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-full transition",
        total > 0
          ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
          : "hover:bg-secondary",
      )}
    >
      <ClipboardList className={cn("h-5 w-5", total > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />

      {total > 0 && (
        <>
          {/* Blinking red light */}
          <span
            className="approval-blink absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 approval-ping" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-600 border border-white dark:border-sidebar-background" />
          </span>
          {/* Count badge */}
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {total > 99 ? "99+" : total}
          </span>
        </>
      )}
    </button>
  );
}
