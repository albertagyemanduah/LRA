/// <reference path="../pb_data/types.d.ts" />

// Add land metadata fields to payments collection for invoice-to-land linking

migrate(
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    const parcels = app.findCollectionByNameOrId("parcels");

    // Link to parcel
    if (!payments.fields.getByName("parcel")) {
      payments.fields.add(new RelationField({
        name: "parcel",
        required: false,
        maxSelect: 1,
        collectionId: parcels.id,
        cascadeDelete: false,
      }));
    }

    // Snapshot fields for invoice/receipt display
    const textFields = [
      { name: "parcelNumber", max: 60 },
      { name: "plotNumber", max: 60 },
      { name: "block", max: 60 },
      { name: "areaCouncil", max: 120 },
      { name: "community", max: 120 },
      { name: "sector", max: 80 },
      { name: "ownerName", max: 200 },
      { name: "ownerPhone", max: 30 },
      { name: "ownerEmail", max: 200 },
    ];

    for (const f of textFields) {
      if (!payments.fields.getByName(f.name)) {
        payments.fields.add(new TextField({ name: f.name, max: f.max, required: false }));
      }
    }

    app.save(payments);
  },
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    const toRemove = ["parcel", "parcelNumber", "plotNumber", "block", "areaCouncil", "community", "sector", "ownerName", "ownerPhone", "ownerEmail"];
    for (const name of toRemove) {
      if (payments.fields.getByName(name)) payments.fields.removeByName(name);
    }
    app.save(payments);
  }
);
