// apps/pocketbase/pb_migrations/1788352142_add_additional_lands_to_parcels.js
/// <reference path="../pb_data/types.d.ts" />

// Adds a `additionalLands` JSON field to the `parcels` collection.
// Stores an array of the owner's other land references, each:
//   { community, areaCouncil, plotNumber, block }
// Optional, owner-scoped, never exposed publicly.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("parcels");

    const existing = collection.fields.getByName("additionalLands");
    if (existing) {
      if (existing.type() === "json") return; // correct type already
      collection.fields.removeByName("additionalLands");
    }

    collection.fields.add(
      new JSONField({
        name: "additionalLands",
        required: false,
        maxSize: 200000,
      }),
    );
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("parcels");
      collection.fields.removeByName("additionalLands");
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
