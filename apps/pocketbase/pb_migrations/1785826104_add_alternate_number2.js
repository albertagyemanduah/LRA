/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Add alternateNumber2 to parcels
    const parcels = app.findCollectionByNameOrId("parcels");
    const existingP = parcels.fields.getByName("alternateNumber2");
    if (!existingP) {
      parcels.fields.add(new TextField({ name: "alternateNumber2", max: 30 }));
      app.save(parcels);
    }

    // Add alternateNumber2 to users
    const users = app.findCollectionByNameOrId("users");
    const existingU = users.fields.getByName("alternateNumber2");
    if (!existingU) {
      users.fields.add(new TextField({ name: "alternateNumber2", max: 30 }));
      app.save(users);
    }
  },
  (app) => {
    try {
      const parcels = app.findCollectionByNameOrId("parcels");
      parcels.fields.removeByName("alternateNumber2");
      app.save(parcels);
    } catch (_) {}
    try {
      const users = app.findCollectionByNameOrId("users");
      users.fields.removeByName("alternateNumber2");
      app.save(users);
    } catch (_) {}
  },
);
