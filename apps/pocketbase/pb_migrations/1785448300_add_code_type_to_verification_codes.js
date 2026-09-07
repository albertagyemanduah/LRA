/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const vc = app.findCollectionByNameOrId("verification_codes");
    if (!vc.fields.getByName("codeType")) {
      vc.fields.add(
        new SelectField({
          name: "codeType",
          maxSelect: 1,
          values: ["community", "admin"],
        }),
      );
    }
    app.save(vc);

    // Backfill existing rows as community codes
    const rows = app.findRecordsByFilter("verification_codes", "id != ''", "", 0, 0);
    for (const r of rows) {
      if (!r.get("codeType")) {
        r.set("codeType", "community");
        app.save(r);
      }
    }
  },
  (app) => {
    const vc = app.findCollectionByNameOrId("verification_codes");
    vc.fields.removeByName("codeType");
    app.save(vc);
  },
);
