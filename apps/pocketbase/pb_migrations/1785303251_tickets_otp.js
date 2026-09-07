/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // tickets collection
    let tickets;
    try {
      tickets = app.findCollectionByNameOrId("tickets");
    } catch (_) {
      tickets = new Collection({
        type: "base",
        name: "tickets",
        listRule: "@request.auth.id != '' && (@request.auth.id = submittedBy || @request.auth.role = 'admin')",
        viewRule: "@request.auth.id != '' && (@request.auth.id = submittedBy || @request.auth.role = 'admin')",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = submittedBy)",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "subject", type: "text", required: true, max: 200 },
          { name: "category", type: "select", maxSelect: 1, values: ["Bug Report", "Feature Request", "General Inquiry", "Complaint", "Technical Issue", "Data Issue", "Other"] },
          { name: "priority", type: "select", maxSelect: 1, values: ["Low", "Medium", "High", "Urgent"] },
          { name: "description", type: "text", required: true, max: 5000 },
          { name: "status", type: "select", maxSelect: 1, values: ["Open", "In Progress", "Resolved", "Closed"] },
          { name: "submittedBy", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "assignedTo", type: "relation", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "relatedLandId", type: "text", max: 80 },
          { name: "attachments", type: "file", maxSelect: 5, maxSize: 10000000 },
          { name: "internalNotes", type: "text", max: 3000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(tickets);
    }

    // ticket_comments
    try {
      app.findCollectionByNameOrId("ticket_comments");
    } catch (_) {
      const tc = new Collection({
        type: "base",
        name: "ticket_comments",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.id = author",
        deleteRule: "@request.auth.id != '' && (@request.auth.id = author || @request.auth.role = 'admin')",
        fields: [
          { name: "ticket", type: "relation", required: true, maxSelect: 1, collectionId: tickets.id, cascadeDelete: true },
          { name: "author", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "message", type: "text", required: true, max: 3000 },
          { name: "isInternal", type: "bool" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
      });
      app.save(tc);
    }

    // otp_sessions
    try {
      app.findCollectionByNameOrId("otp_sessions");
    } catch (_) {
      const otp = new Collection({
        type: "base",
        name: "otp_sessions",
        listRule: null,
        viewRule: null,
        createRule: "",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "userId", type: "text", max: 30 },
          { name: "email", type: "text", max: 200 },
          { name: "phone", type: "text", max: 30 },
          { name: "code", type: "text", max: 10 },
          { name: "expiresAt", type: "date" },
          { name: "used", type: "bool" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
      });
      app.save(otp);
    }
  },
  (app) => {
    for (const name of ["ticket_comments", "tickets", "otp_sessions"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }
  },
);
