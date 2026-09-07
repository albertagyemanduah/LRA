/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ---- users: extend with role + Ghana Card + profile ----
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("role")) {
      users.fields.add(
        new SelectField({
          name: "role",
          required: true,
          maxSelect: 1,
          values: [
            "citizen",
            "planning_officer",
            "survey_officer",
            "registrar",
            "finance_officer",
            "admin",
            "customary_secretariat",
          ],
        }),
      );
    }
    if (!users.fields.getByName("fullName")) {
      users.fields.add(new TextField({ name: "fullName", max: 120 }));
    }
    if (!users.fields.getByName("ghanaCard")) {
      users.fields.add(new TextField({ name: "ghanaCard", max: 40 }));
    }
    if (!users.fields.getByName("phone")) {
      users.fields.add(new TextField({ name: "phone", max: 30 }));
    }
    if (!users.fields.getByName("mfaEnabled")) {
      users.fields.add(new BoolField({ name: "mfaEnabled" }));
    }
    users.listRule = "@request.auth.id != ''";
    users.viewRule = "@request.auth.id != ''";
    users.updateRule = "id = @request.auth.id || @request.auth.role = 'admin'";
    users.manageRule = "@request.auth.role = 'admin'";
    app.save(users);

    const staffOrOwner = (ownerField) =>
      `@request.auth.id != '' && (@request.auth.id = ${ownerField} || @request.auth.role != 'citizen')`;

    // ---- parcels (Land Registration + Cadastral) ----
    const parcels = new Collection({
      type: "base",
      name: "parcels",
      listRule: staffOrOwner("owner"),
      viewRule: staffOrOwner("owner"),
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.id = owner || @request.auth.role != 'citizen')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "parcelNumber", type: "text", required: true, max: 60 },
        { name: "title", type: "text", required: true, max: 200 },
        { name: "location", type: "text", max: 200 },
        {
          name: "landUse",
          type: "select",
          maxSelect: 1,
          values: ["residential", "commercial", "agricultural", "industrial", "mixed", "customary"],
        },
        {
          name: "tenure",
          type: "select",
          maxSelect: 1,
          values: ["freehold", "leasehold", "customary", "stool", "family"],
        },
        { name: "area", type: "number", min: 0 },
        { name: "coordinates", type: "json", maxSize: 200000 },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["draft", "submitted", "under_survey", "under_review", "registered", "disputed", "rejected"],
        },
        { name: "description", type: "text", max: 2000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(parcels);

    // ---- applications (Application & Workflow) ----
    const applications = new Collection({
      type: "base",
      name: "applications",
      listRule: staffOrOwner("applicant"),
      viewRule: staffOrOwner("applicant"),
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.id = applicant || @request.auth.role != 'citizen')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: "applicant",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        {
          name: "parcel",
          type: "relation",
          maxSelect: 1,
          collectionId: parcels.id,
          cascadeDelete: false,
        },
        { name: "reference", type: "text", max: 60 },
        {
          name: "type",
          type: "select",
          maxSelect: 1,
          values: ["registration", "transfer", "subdivision", "title_search", "customary_record", "renewal"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["submitted", "planning_review", "survey", "registrar_review", "approved", "rejected", "completed"],
        },
        { name: "notes", type: "text", max: 3000 },
        {
          name: "reviewLog",
          type: "json",
          maxSize: 500000,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(applications);

    // ---- documents (Document Management) ----
    const documents = new Collection({
      type: "base",
      name: "documents",
      listRule: staffOrOwner("owner"),
      viewRule: staffOrOwner("owner"),
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.id = owner || @request.auth.role != 'citizen')",
      deleteRule: "@request.auth.id != '' && (@request.auth.id = owner || @request.auth.role = 'admin')",
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        {
          name: "parcel",
          type: "relation",
          maxSelect: 1,
          collectionId: parcels.id,
          cascadeDelete: false,
        },
        { name: "title", type: "text", required: true, max: 200 },
        {
          name: "docType",
          type: "select",
          maxSelect: 1,
          values: ["deed", "site_plan", "indenture", "ghana_card", "survey_report", "certificate", "receipt", "other"],
        },
        { name: "file", type: "file", maxSelect: 1, maxSize: 15000000 },
        { name: "version", type: "number", min: 1, onlyInt: true },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["pending_scan", "verified", "rejected"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(documents);

    // ---- surveys (Cadastral & Survey) ----
    const surveys = new Collection({
      type: "base",
      name: "surveys",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role != 'citizen'",
      updateRule: "@request.auth.id != '' && @request.auth.role != 'citizen'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: "parcel",
          type: "relation",
          maxSelect: 1,
          collectionId: parcels.id,
          cascadeDelete: false,
        },
        {
          name: "surveyor",
          type: "relation",
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "surveyDate", type: "date" },
        { name: "boundaries", type: "json", maxSize: 500000 },
        { name: "computedArea", type: "number", min: 0 },
        { name: "beacons", type: "text", max: 2000 },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["scheduled", "in_progress", "completed", "verified"],
        },
        { name: "notes", type: "text", max: 2000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(surveys);

    // ---- payments (Payment & Revenue) ----
    const payments = new Collection({
      type: "base",
      name: "payments",
      listRule:
        "@request.auth.id != '' && (@request.auth.id = payer || @request.auth.role = 'finance_officer' || @request.auth.role = 'admin')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.id = payer || @request.auth.role = 'finance_officer' || @request.auth.role = 'admin')",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'finance_officer' || @request.auth.role = 'admin')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: "payer",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        {
          name: "application",
          type: "relation",
          maxSelect: 1,
          collectionId: applications.id,
          cascadeDelete: false,
        },
        { name: "invoiceNumber", type: "text", max: 60 },
        {
          name: "purpose",
          type: "select",
          maxSelect: 1,
          values: ["registration_fee", "search_fee", "survey_fee", "processing_fee", "ground_rent", "penalty"],
        },
        { name: "amount", type: "number", min: 0 },
        {
          name: "method",
          type: "select",
          maxSelect: 1,
          values: ["mobile_money", "card", "bank_transfer", "cash"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["pending", "paid", "failed", "refunded"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(payments);

    // ---- audit_logs (Compliance / Audit Trails) ----
    const audit = new Collection({
      type: "base",
      name: "audit_logs",
      listRule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = actor)",
      viewRule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = actor)",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: "actor",
          type: "relation",
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "action", type: "text", required: true, max: 200 },
        { name: "entity", type: "text", max: 120 },
        { name: "details", type: "text", max: 2000 },
        { name: "ip", type: "text", max: 60 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(audit);

    // ---- notifications ----
    const notifications = new Collection({
      type: "base",
      name: "notifications",
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
        { name: "message", type: "text", required: true, max: 500 },
        { name: "link", type: "text", max: 200 },
        { name: "read", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
    });
    app.save(notifications);
  },
  (app) => {
    for (const name of [
      "notifications",
      "audit_logs",
      "payments",
      "surveys",
      "documents",
      "applications",
      "parcels",
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {}
    }
  },
);
