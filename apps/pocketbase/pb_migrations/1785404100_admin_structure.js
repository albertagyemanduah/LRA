/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const base = (name, extraFields) => {
      let col;
      try { col = app.findCollectionByNameOrId(name); return col; } catch (_) {}
      col = new Collection({
        type: "base",
        name,
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "name", type: "text", required: true, max: 200 },
          { name: "description", type: "text", max: 1000 },
          { name: "code", type: "text", max: 60 },
          { name: "status", type: "select", maxSelect: 1, values: ["active", "inactive"] },
          ...extraFields,
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(col);
      return col;
    };

    const communities = base("communities", []);
    const areaCouncils = base("area_councils", [
      { name: "community", type: "relation", maxSelect: 1, collectionId: communities.id, cascadeDelete: false },
    ]);
    const sectors = base("sectors", [
      { name: "areaCouncil", type: "relation", maxSelect: 1, collectionId: areaCouncils.id, cascadeDelete: false },
      { name: "community", type: "relation", maxSelect: 1, collectionId: communities.id, cascadeDelete: false },
    ]);
    base("offices_struct", [
      { name: "sector", type: "relation", maxSelect: 1, collectionId: sectors.id, cascadeDelete: false },
      { name: "areaCouncil", type: "relation", maxSelect: 1, collectionId: areaCouncils.id, cascadeDelete: false },
      { name: "community", type: "relation", maxSelect: 1, collectionId: communities.id, cascadeDelete: false },
    ]);
  },
  (app) => {
    for (const n of ["offices_struct", "sectors", "area_councils", "communities"]) {
      try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
    }
  },
);
