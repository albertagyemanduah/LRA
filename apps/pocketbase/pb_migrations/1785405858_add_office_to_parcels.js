/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    try { parcels.fields.getByName("office"); } catch (_) {
      parcels.fields.add(new TextField({ name: "office", max: 200 }));
      app.save(parcels);
    }
  },
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    try { parcels.fields.removeByName("office"); app.save(parcels); } catch (_) {}
  }
);
