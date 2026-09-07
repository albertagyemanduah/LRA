/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("users");
    col.fields.add(new BoolField({ name: "suspended", required: false }));
    col.fields.add(new TextField({ name: "suspendedReason", max: 500, required: false }));
    col.fields.add(new DateField({ name: "suspendedUntil", required: false }));
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("users");
    col.fields.removeByName("suspended");
    col.fields.removeByName("suspendedReason");
    col.fields.removeByName("suspendedUntil");
    app.save(col);
  },
);
