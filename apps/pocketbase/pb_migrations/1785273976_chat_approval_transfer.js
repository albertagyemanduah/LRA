/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const parcels = app.findCollectionByNameOrId("parcels");

    // ---- chat_messages ----
    let chatMessages;
    try { chatMessages = app.findCollectionByNameOrId("chat_messages"); } catch (_) {
      chatMessages = new Collection({
        type: "base",
        name: "chat_messages",
        listRule: "@request.auth.id != '' && (@request.auth.id = sender || @request.auth.id = recipient)",
        viewRule: "@request.auth.id != '' && (@request.auth.id = sender || @request.auth.id = recipient)",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.id = sender",
        deleteRule: "@request.auth.id != '' && @request.auth.id = sender",
        fields: [
          { name: "sender", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "recipient", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "message", type: "text", required: true, max: 2000 },
          { name: "read", type: "bool" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
      });
      app.save(chatMessages);
    }

    // ---- land_edit_requests ----
    let editRequests;
    try { editRequests = app.findCollectionByNameOrId("land_edit_requests"); } catch (_) {
      editRequests = new Collection({
        type: "base",
        name: "land_edit_requests",
        listRule: "@request.auth.id != '' && (@request.auth.id = requestedBy || @request.auth.role = 'admin' || @request.auth.role = 'planning_officer')",
        viewRule: "@request.auth.id != '' && (@request.auth.id = requestedBy || @request.auth.role = 'admin' || @request.auth.role = 'planning_officer')",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "parcel", type: "relation", required: true, maxSelect: 1, collectionId: parcels.id, cascadeDelete: false },
          { name: "requestedBy", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "type", type: "select", required: true, maxSelect: 1, values: ["edit", "delete"] },
          { name: "proposedChanges", type: "json", maxSize: 200000 },
          { name: "reason", type: "text", max: 1000 },
          { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved", "rejected"] },
          { name: "reviewedBy", type: "relation", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "reviewComment", type: "text", max: 1000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(editRequests);
    }

    // ---- land_transfers ----
    let transfers;
    try { transfers = app.findCollectionByNameOrId("land_transfers"); } catch (_) {
      transfers = new Collection({
        type: "base",
        name: "land_transfers",
        listRule: "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'registrar' || @request.auth.role = 'planning_officer')",
        viewRule: "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'registrar' || @request.auth.role = 'planning_officer')",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'registrar')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "parcel", type: "relation", required: true, maxSelect: 1, collectionId: parcels.id, cascadeDelete: false },
          { name: "fromOwner", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "toOwnerUser", type: "relation", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "toOwnerName", type: "text", max: 200 },
          { name: "toOwnerPhone", type: "text", max: 30 },
          { name: "reason", type: "text", max: 1000 },
          { name: "ownershipHistory", type: "json", maxSize: 200000 },
          { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved", "rejected"] },
          { name: "reviewedBy", type: "relation", maxSelect: 1, collectionId: users.id, cascadeDelete: false },
          { name: "reviewComment", type: "text", max: 1000 },
          { name: "certificateNumber", type: "text", max: 80 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(transfers);
    }
  },
  (app) => {
    for (const name of ["land_transfers", "land_edit_requests", "chat_messages"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }
  },
);
