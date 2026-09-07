/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const offices = app.findCollectionByNameOrId("offices_struct");
    const areaCouncils = app.findCollectionByNameOrId("area_councils");
    const communities = app.findCollectionByNameOrId("communities");
    const sectors = app.findCollectionByNameOrId("sectors");

    // offices_struct becomes top-level — remove existing FK fields
    try { offices.fields.removeByName("sector"); } catch (_) {}
    try { offices.fields.removeByName("areaCouncil"); } catch (_) {}
    try { offices.fields.removeByName("community"); } catch (_) {}
    offices.fields.add(new BoolField({ name: "isDeleted" }));
    offices.fields.add(new TextField({ name: "deletedReason", max: 500 }));
    app.save(offices);

    // area_councils: swap community FK for office FK
    try { areaCouncils.fields.removeByName("community"); } catch (_) {}
    areaCouncils.fields.add(new RelationField({
      name: "office",
      maxSelect: 1,
      collectionId: offices.id,
    }));
    areaCouncils.fields.add(new BoolField({ name: "isDeleted" }));
    areaCouncils.fields.add(new TextField({ name: "deletedReason", max: 500 }));
    app.save(areaCouncils);

    // communities: add areaCouncil FK and denormalized office FK
    communities.fields.add(new RelationField({
      name: "areaCouncil",
      maxSelect: 1,
      collectionId: areaCouncils.id,
    }));
    communities.fields.add(new RelationField({
      name: "office",
      maxSelect: 1,
      collectionId: offices.id,
    }));
    communities.fields.add(new BoolField({ name: "isDeleted" }));
    communities.fields.add(new TextField({ name: "deletedReason", max: 500 }));
    app.save(communities);

    // sectors: add office FK (keep existing community and areaCouncil FKs)
    sectors.fields.add(new RelationField({
      name: "office",
      maxSelect: 1,
      collectionId: offices.id,
    }));
    sectors.fields.add(new BoolField({ name: "isDeleted" }));
    sectors.fields.add(new TextField({ name: "deletedReason", max: 500 }));
    app.save(sectors);
  },
  (app) => {
    const offices = app.findCollectionByNameOrId("offices_struct");
    const areaCouncils = app.findCollectionByNameOrId("area_councils");
    const communities = app.findCollectionByNameOrId("communities");
    const sectors = app.findCollectionByNameOrId("sectors");

    try { offices.fields.removeByName("isDeleted"); } catch (_) {}
    try { offices.fields.removeByName("deletedReason"); } catch (_) {}
    offices.fields.add(new RelationField({ name: "sector", maxSelect: 1, collectionId: sectors.id }));
    offices.fields.add(new RelationField({ name: "areaCouncil", maxSelect: 1, collectionId: areaCouncils.id }));
    offices.fields.add(new RelationField({ name: "community", maxSelect: 1, collectionId: communities.id }));
    app.save(offices);

    try { areaCouncils.fields.removeByName("office"); } catch (_) {}
    try { areaCouncils.fields.removeByName("isDeleted"); } catch (_) {}
    try { areaCouncils.fields.removeByName("deletedReason"); } catch (_) {}
    areaCouncils.fields.add(new RelationField({ name: "community", maxSelect: 1, collectionId: communities.id }));
    app.save(areaCouncils);

    try { communities.fields.removeByName("areaCouncil"); } catch (_) {}
    try { communities.fields.removeByName("office"); } catch (_) {}
    try { communities.fields.removeByName("isDeleted"); } catch (_) {}
    try { communities.fields.removeByName("deletedReason"); } catch (_) {}
    app.save(communities);

    try { sectors.fields.removeByName("office"); } catch (_) {}
    try { sectors.fields.removeByName("isDeleted"); } catch (_) {}
    try { sectors.fields.removeByName("deletedReason"); } catch (_) {}
    app.save(sectors);
  }
);
