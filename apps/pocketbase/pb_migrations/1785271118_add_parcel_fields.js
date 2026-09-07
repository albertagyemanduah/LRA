/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");

    const newFields = [
      { name: "areaCouncil", type: "text", max: 120 },
      { name: "community", type: "text", max: 120 },
      { name: "applicantName", type: "text", max: 200 },
      { name: "religion", type: "text", max: 80 },
      { name: "tribe", type: "text", max: 80 },
      { name: "sector", type: "text", max: 80 },
      { name: "plotNumber", type: "text", max: 60 },
      { name: "sectorPlotBlock", type: "text", max: 120 },
      { name: "allocationDate", type: "date" },
      { name: "registrationDate", type: "date" },
      { name: "contactPhone", type: "text", max: 30 },
    ];

    for (const f of newFields) {
      if (!parcels.fields.getByName(f.name)) {
        if (f.type === "date") {
          parcels.fields.add(new DateField({ name: f.name, required: false }));
        } else {
          parcels.fields.add(new TextField({ name: f.name, max: f.max, required: false }));
        }
      }
    }

    app.save(parcels);
  },
  (app) => {
    const parcels = app.findCollectionByNameOrId("parcels");
    const toRemove = [
      "areaCouncil", "community", "applicantName", "religion", "tribe",
      "sector", "plotNumber", "sectorPlotBlock", "allocationDate", "registrationDate", "contactPhone",
    ];
    for (const name of toRemove) {
      if (parcels.fields.getByName(name)) {
        parcels.fields.removeByName(name);
      }
    }
    app.save(parcels);
  },
);
