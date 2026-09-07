/// <reference path="../pb_data/types.d.ts" />

// Remove citizen-specific access rules now that citizen role is eliminated.
// All users are staff; area council filtering is handled on the frontend.

migrate(
  (app) => {
    const allStaff = "@request.auth.id != ''";

    const collectionsToUpdate = [
      { name: "parcels", rules: { list: allStaff, view: allStaff, create: allStaff, update: allStaff, delete: "@request.auth.id != '' && @request.auth.role = 'admin'" } },
      { name: "applications", rules: { list: allStaff, view: allStaff, create: allStaff, update: allStaff, delete: "@request.auth.id != '' && @request.auth.role = 'admin'" } },
      { name: "documents", rules: { list: allStaff, view: allStaff, create: allStaff, update: allStaff, delete: allStaff } },
    ];

    for (const { name, rules } of collectionsToUpdate) {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.listRule = rules.list;
        col.viewRule = rules.view;
        col.createRule = rules.create;
        col.updateRule = rules.update;
        col.deleteRule = rules.delete;
        app.save(col);
      } catch (e) {
        console.log(`Skip ${name}: ${e.message}`);
      }
    }
  },
  (app) => {
    // Restore previous rules - left as no-op since rollback would reintroduce citizen logic
  },
);
