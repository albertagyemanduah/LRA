/// <reference path="../pb_data/types.d.ts" />

// Persist approval notifications to all approvers (admin + planning_officer)
// when a new pending land_edit_request or land_transfer is created.
// Each callback is fully self-contained (JSVM hook scopes are isolated) and
// wrapped in try/catch so a notification failure can never abort the record
// creation (which previously surfaced as "Failed to create record").

onRecordAfterCreateSuccess((e) => {
  try {
    const notifyApprovers = (message, link) => {
      const users = $app.findCollectionByNameOrId("users");
      const records = $app.findRecordsByFilter(
        users.id,
        'role = "admin" || role = "planning_officer"',
        "",
        0,
      );
      const notifs = $app.findCollectionByNameOrId("notifications");
      records.forEach((u) => {
        try {
          const n = new Record(notifs);
          n.set("user", u.id);
          n.set("message", String(message).slice(0, 500));
          if (link) n.set("link", link);
          n.set("read", false);
          $app.save(n);
        } catch (err) {
          $app.logger().error("approval-notif per-user failed", "user", u.id, "err", String(err));
        }
      });
    };

    if (e.record.get("status") === "pending") {
      const type = e.record.get("type") || "edit";
      const reason = e.record.get("reason") || "";
      notifyApprovers(
        `New ${type} request awaiting review${reason ? ": " + reason : ""}`,
        "/app/approvals",
      );
    }
  } catch (err) {
    $app.logger().error("approval-notif edit-request hook failed", "err", String(err));
  }

  e.next();
}, "land_edit_requests");

onRecordAfterCreateSuccess((e) => {
  try {
    const notifyApprovers = (message, link) => {
      const users = $app.findCollectionByNameOrId("users");
      const records = $app.findRecordsByFilter(
        users.id,
        'role = "admin" || role = "planning_officer"',
        "",
        0,
      );
      const notifs = $app.findCollectionByNameOrId("notifications");
      records.forEach((u) => {
        try {
          const n = new Record(notifs);
          n.set("user", u.id);
          n.set("message", String(message).slice(0, 500));
          if (link) n.set("link", link);
          n.set("read", false);
          $app.save(n);
        } catch (err) {
          $app.logger().error("approval-notif per-user failed", "user", u.id, "err", String(err));
        }
      });
    };

    if (e.record.get("status") === "pending") {
      const toOwner = e.record.get("toOwnerName") || "a new owner";
      const reason = e.record.get("reason") || "";
      notifyApprovers(
        `New land transfer request to ${toOwner} awaiting approval${reason ? " — " + reason : ""}`,
        "/app/approvals",
      );
    }
  } catch (err) {
    $app.logger().error("approval-notif transfer hook failed", "err", String(err));
  }

  e.next();
}, "land_transfers");
