/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const newFields = [
      { name: "firstName", type: "text", max: 80 },
      { name: "middleName", type: "text", max: 80 },
      { name: "surname", type: "text", max: 80 },
      { name: "whatsappNumber", type: "text", max: 30 },
      { name: "roles", type: "json", maxSize: 2000 },
    ];

    for (const f of newFields) {
      if (!users.fields.getByName(f.name)) {
        if (f.type === "json") {
          users.fields.add(new JSONField({ name: f.name, maxSize: f.maxSize }));
        } else {
          users.fields.add(new TextField({ name: f.name, max: f.max, required: false }));
        }
      }
    }

    app.save(users);
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      for (const name of ["firstName", "middleName", "surname", "whatsappNumber", "roles"]) {
        if (users.fields.getByName(name)) users.fields.removeByName(name);
      }
      app.save(users);
    } catch (_) {}
  },
);
