/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    // Allow public (unauthenticated) list and view for land verification
    parcels.listRule = "";
    parcels.viewRule = "";
    app.save(parcels);
  },
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    parcels.listRule = "@request.auth.id != ''";
    parcels.viewRule = "@request.auth.id != ''";
    app.save(parcels);
  },
);
