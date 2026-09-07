/// <reference path="../pb_data/types.d.ts" />

// Add a composite index on parcels (sector, plotNumber, block) to speed up the
// Sector + Plot Number + Block duplicate-detection query used by registration,
// edit, amendment, transfer, and bulk import forms.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("parcels");
    const idx = "CREATE INDEX `idx_parcels_sector_plot_block` ON `parcels` (`sector`, `plotNumber`, `block`)";
    const exists = (collection.indexes || []).some((s) => String(s).includes("idx_parcels_sector_plot_block"));
    if (!exists) collection.indexes.push(idx);
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("parcels");
    collection.indexes = (collection.indexes || []).filter(
      (s) => !String(s).includes("idx_parcels_sector_plot_block"),
    );
    app.save(collection);
  },
);
