/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Add office and userAreaCouncil to users
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("office")) {
      users.fields.add(
        new SelectField({
          name: "office",
          required: false,
          maxSelect: 1,
          values: ["tuobodom_office", "offuman_office", "akrofrom_office"],
        }),
      );
    }
    app.save(users);

    // Add new parcel fields
    const parcels = app.findCollectionByNameOrId("parcels");
    const newFields = [
      { name: "alternateMobile", type: "text", max: 30 },
      { name: "whatsapp", type: "text", max: 30 },
      { name: "applicantEmail", type: "email" },
      { name: "block", type: "text", max: 60 },
    ];
    for (const f of newFields) {
      if (!parcels.fields.getByName(f.name)) {
        if (f.type === "email") {
          parcels.fields.add(new EmailField({ name: f.name, required: false }));
        } else {
          parcels.fields.add(new TextField({ name: f.name, max: f.max, required: false }));
        }
      }
    }
    app.save(parcels);
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      if (users.fields.getByName("office")) users.fields.removeByName("office");
      app.save(users);
    } catch (_) {}

    try {
      const parcels = app.findCollectionByNameOrId("parcels");
      for (const name of ["alternateMobile", "whatsapp", "applicantEmail", "block"]) {
        if (parcels.fields.getByName(name)) parcels.fields.removeByName(name);
      }
      app.save(parcels);
    } catch (_) {}
  },
);
