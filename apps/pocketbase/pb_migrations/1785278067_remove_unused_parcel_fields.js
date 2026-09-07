/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    const toRemove = ["title", "location", "landUse", "tenure", "area", "coordinates", "description", "sectorPlotBlock"];
    for (const name of toRemove) {
      if (parcels.fields.getByName(name)) {
        parcels.fields.removeByName(name);
      }
    }
    app.save(parcels);
  },
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    // Restore removed fields (data is lost, structure only)
    const fields = [
      new TextField({ name: "title", required: false, max: 200 }),
      new TextField({ name: "location", max: 200 }),
      new SelectField({ name: "landUse", maxSelect: 1, values: ["residential","commercial","agricultural","industrial","mixed","customary"] }),
      new SelectField({ name: "tenure", maxSelect: 1, values: ["freehold","leasehold","customary","stool","family"] }),
      new NumberField({ name: "area", min: 0 }),
      new JsonField({ name: "coordinates", maxSize: 200000 }),
      new TextField({ name: "description", max: 2000 }),
      new TextField({ name: "sectorPlotBlock", max: 120 }),
    ];
    for (const f of fields) {
      if (!parcels.fields.getByName(f.name)) parcels.fields.add(f);
    }
    app.save(parcels);
  }
);
