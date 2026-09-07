/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("land_transfers");
    if (!col.fields.getByName("transferLetter")) {
      col.fields.add(new FileField({
        name: "transferLetter",
        maxSelect: 1,
        maxSize: 921600, // 900KB
        mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"],
      }));
      app.save(col);
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId("land_transfers");
    col.fields.removeByName("transferLetter");
    app.save(col);
  }
);
