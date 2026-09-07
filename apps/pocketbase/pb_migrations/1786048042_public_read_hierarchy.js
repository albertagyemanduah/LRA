/// <reference path="../pb_data/types.d.ts" />

// Allow public (unauthenticated) read of hierarchy collections so the
// public land verification page can populate its cascading dropdowns.
migrate(
  (app) => {
    for (const name of ["area_councils", "communities", "sectors"]) {
      const col = app.findCollectionByNameOrId(name);
      col.listRule = "";
      col.viewRule = "";
      app.save(col);
    }
  },
  (app) => {
    for (const name of ["area_councils", "communities", "sectors"]) {
      const col = app.findCollectionByNameOrId(name);
      col.listRule = "@request.auth.id != ''";
      col.viewRule = "@request.auth.id != ''";
      app.save(col);
    }
  }
);
