/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    if (!collection.fields.getByName("officeRef")) {
      collection.fields.add(new TextField({ name: "officeRef", max: 200 }));
    }
    if (!collection.fields.getByName("areaCouncilRef")) {
      collection.fields.add(new TextField({ name: "areaCouncilRef", max: 200 }));
    }
    if (!collection.fields.getByName("communityRef")) {
      collection.fields.add(new TextField({ name: "communityRef", max: 200 }));
    }
    if (!collection.fields.getByName("sectorRef")) {
      collection.fields.add(new TextField({ name: "sectorRef", max: 200 }));
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("users");
    ["officeRef", "areaCouncilRef", "communityRef", "sectorRef"].forEach((name) => {
      try { collection.fields.removeByName(name); } catch (_) {}
    });
    app.save(collection);
  }
);
