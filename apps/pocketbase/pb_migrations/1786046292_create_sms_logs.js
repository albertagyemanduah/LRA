/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    let col;
    try {
      col = app.findCollectionByNameOrId("sms_logs");
    } catch (_) {
      col = new Collection({
        type: "base",
        name: "sms_logs",
        listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: null,
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "sentBy", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "recipientId", type: "text", max: 20 },
          { name: "recipientName", type: "text", max: 200 },
          { name: "recipientPhone", type: "text", max: 30 },
          { name: "message", type: "text", max: 1000, required: true },
          { name: "status", type: "select", maxSelect: 1, values: ["sent", "failed", "pending"] },
          { name: "errorMsg", type: "text", max: 500 },
          { name: "isBulk", type: "bool" },
          { name: "bulkGroup", type: "text", max: 60 },
          { name: "templateName", type: "text", max: 100 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_sms_logs_sentBy ON sms_logs (sentBy)",
          "CREATE INDEX idx_sms_logs_created ON sms_logs (created)",
        ],
      });
      app.save(col);
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("sms_logs");
      app.delete(col);
    } catch (_) {}
  }
);
