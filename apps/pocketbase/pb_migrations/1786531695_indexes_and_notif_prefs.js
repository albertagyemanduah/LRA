/// <reference path="../pb_data/types.d.ts" />

// Performance indexes + notification preferences collection.
// Adds hot-path indexes to land_transfers, audit_logs, parcels, payments
// and creates a notification_preferences collection for per-user
// notification channel/frequency/quiet-hours settings.

migrate(
  (app) => {
    // ── Indexes on existing collections ──────────────────────────────
    const addIndex = (collectionName, indexSql) => {
      let col;
      try {
        col = app.findCollectionByNameOrId(collectionName);
      } catch (_) {
        return; // collection missing — skip silently
      }
      const sig = indexSql.replace(/`/g, "").slice(0, 60);
      const exists = (col.indexes || []).some((idx) => idx.replace(/`/g, "").includes(sig));
      if (!exists) {
        col.indexes.push(indexSql);
        app.save(col);
      }
    };

    addIndex("land_transfers", "CREATE INDEX `idx_lt_status` ON `land_transfers` (`status`)");
    addIndex("land_transfers", "CREATE INDEX `idx_lt_parcel` ON `land_transfers` (`parcel`)");
    addIndex("land_transfers", "CREATE INDEX `idx_lt_fromOwner` ON `land_transfers` (`fromOwner`)");
    addIndex("land_transfers", "CREATE INDEX `idx_lt_reviewedBy` ON `land_transfers` (`reviewedBy`)");
    addIndex("land_transfers", "CREATE INDEX `idx_lt_created` ON `land_transfers` (`created`)");

    addIndex("audit_logs", "CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`)");
    addIndex("audit_logs", "CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity`)");
    addIndex("audit_logs", "CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor`)");
    addIndex("audit_logs", "CREATE INDEX `idx_audit_created` ON `audit_logs` (`created`)");

    addIndex("parcels", "CREATE INDEX `idx_parcels_status` ON `parcels` (`status`)");
    addIndex("parcels", "CREATE INDEX `idx_parcels_areaCouncil` ON `parcels` (`areaCouncil`)");
    addIndex("parcels", "CREATE INDEX `idx_parcels_community` ON `parcels` (`community`)");
    addIndex("parcels", "CREATE INDEX `idx_parcels_owner` ON `parcels` (`owner`)");
    addIndex("parcels", "CREATE INDEX `idx_parcels_parcelNumber` ON `parcels` (`parcelNumber`)");

    addIndex("payments", "CREATE INDEX `idx_payments_status` ON `payments` (`status`)");
    addIndex("payments", "CREATE INDEX `idx_payments_payer` ON `payments` (`payer`)");
    addIndex("payments", "CREATE INDEX `idx_payments_created` ON `payments` (`created`)");

    addIndex("notifications", "CREATE INDEX `idx_notif_user_read` ON `notifications` (`user`, `read`)");
    addIndex("notifications", "CREATE INDEX `idx_notif_created` ON `notifications` (`created`)");

    // ── notification_preferences collection ──────────────────────────
    const users = app.findCollectionByNameOrId("users");

    let prefs;
    try {
      prefs = app.findCollectionByNameOrId("notification_preferences");
    } catch (_) {
      prefs = new Collection({
        type: "base",
        name: "notification_preferences",
        listRule: "@request.auth.id != '' && @request.auth.id = user",
        viewRule: "@request.auth.id != '' && @request.auth.id = user",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.id = user",
        deleteRule: "@request.auth.id != '' && @request.auth.id = user",
        fields: [
          {
            name: "user",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          {
            name: "channels",
            type: "json",
          },
          {
            name: "transferAlerts",
            type: "bool",
          },
          {
            name: "editAlerts",
            type: "bool",
          },
          {
            name: "deleteAlerts",
            type: "bool",
          },
          {
            name: "approvalAlerts",
            type: "bool",
          },
          {
            name: "rejectionAlerts",
            type: "bool",
          },
          {
            name: "reminderAlerts",
            type: "bool",
          },
          {
            name: "frequency",
            type: "select",
            maxSelect: 1,
            values: ["instant", "daily", "weekly"],
          },
          {
            name: "quietHoursStart",
            type: "text",
            max: 5,
          },
          {
            name: "quietHoursEnd",
            type: "text",
            max: 5,
          },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(prefs);
    }

    // unique index so each user has at most one preferences row
    const hasUnique = (prefs.indexes || []).some((i) => i.includes("idx_notifprefs_user"));
    if (!hasUnique) {
      prefs.indexes.push("CREATE UNIQUE INDEX `idx_notifprefs_user` ON `notification_preferences` (`user`)");
      app.save(prefs);
    }
  },
  (app) => {
    // down — remove indexes (best effort) and drop collection
    const dropIndex = (collectionName, sig) => {
      try {
        const col = app.findCollectionByNameOrId(collectionName);
        col.indexes = (col.indexes || []).filter((i) => !i.replace(/`/g, "").includes(sig));
        app.save(col);
      } catch (_) {}
    };
    ["idx_lt_status","idx_lt_parcel","idx_lt_fromOwner","idx_lt_reviewedBy","idx_lt_created"].forEach((s) => dropIndex("land_transfers", s));
    ["idx_audit_action","idx_audit_entity","idx_audit_actor","idx_audit_created"].forEach((s) => dropIndex("audit_logs", s));
    ["idx_parcels_status","idx_parcels_areaCouncil","idx_parcels_community","idx_parcels_owner","idx_parcels_parcelNumber"].forEach((s) => dropIndex("parcels", s));
    ["idx_payments_status","idx_payments_payer","idx_payments_created"].forEach((s) => dropIndex("payments", s));
    ["idx_notif_user_read","idx_notif_created"].forEach((s) => dropIndex("notifications", s));

    try {
      const prefs = app.findCollectionByNameOrId("notification_preferences");
      app.delete(prefs);
    } catch (_) {}
  },
);
