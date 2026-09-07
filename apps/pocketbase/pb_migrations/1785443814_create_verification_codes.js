/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // verification_codes collection
    const vc = new Collection({
      type: "base",
      name: "verification_codes",
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: "code", type: "text", required: true, max: 80 },
        { name: "officeRef", type: "text", max: 200 },
        { name: "areaCouncilRef", type: "text", max: 200 },
        { name: "communityRef", type: "text", max: 200 },
        { name: "description", type: "text", max: 500 },
        {
          name: "createdBy",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "expiresAt", type: "date" },
        { name: "maxUsage", type: "number", min: 0 },
        { name: "usageCount", type: "number", min: 0 },
        { name: "lastUsedAt", type: "date" },
        { name: "isActive", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_vcodes_code ON verification_codes (LOWER(code))",
        "CREATE INDEX idx_vcodes_community ON verification_codes (communityRef)",
        "CREATE INDEX idx_vcodes_active ON verification_codes (isActive)",
      ],
    });
    app.save(vc);

    // verification_logs collection
    const vl = new Collection({
      type: "base",
      name: "verification_logs",
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "code", type: "text", max: 80 },
        { name: "status", type: "select", maxSelect: 1, values: ["success", "failure"] },
        { name: "reason", type: "text", max: 300 },
        { name: "communityRef", type: "text", max: 200 },
        { name: "searchFilters", type: "json", maxSize: 5000 },
        { name: "resultsCount", type: "number", min: 0 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(vl);
  },
  (app) => {
    try { app.delete(app.findCollectionByNameOrId("verification_logs")); } catch (_) {}
    try { app.delete(app.findCollectionByNameOrId("verification_codes")); } catch (_) {}
  },
);
