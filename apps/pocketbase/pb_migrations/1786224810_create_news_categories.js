/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let col;
    try {
      col = app.findCollectionByNameOrId("news_categories");
    } catch (_) {
      col = new Collection({
        type: "base",
        name: "news_categories",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "name", type: "text", required: true, max: 100 },
          { name: "description", type: "text", max: 500 },
          { name: "color", type: "text", max: 20 },
          { name: "slug", type: "text", max: 120 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_news_cat_name ON news_categories (LOWER(name))"],
      });
      app.save(col);
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("news_categories");
      app.delete(col);
    } catch (_) {}
  },
);
