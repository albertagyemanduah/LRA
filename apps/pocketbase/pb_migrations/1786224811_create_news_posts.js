/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let col;
    try {
      col = app.findCollectionByNameOrId("news_posts");
    } catch (_) {
      const users = app.findCollectionByNameOrId("users");
      const cats = app.findCollectionByNameOrId("news_categories");
      col = new Collection({
        type: "base",
        name: "news_posts",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: "title", type: "text", required: true, max: 300 },
          { name: "slug", type: "text", max: 350 },
          { name: "excerpt", type: "text", max: 600 },
          { name: "content", type: "editor", maxSize: 2000000 },
          {
            name: "type",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["news", "article"],
          },
          {
            name: "status",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["draft", "published"],
          },
          {
            name: "featuredImage",
            type: "file",
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          },
          {
            name: "category",
            type: "relation",
            maxSelect: 1,
            collectionId: cats.id,
          },
          {
            name: "author",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
          },
          { name: "publishedAt", type: "date" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_news_posts_type ON news_posts (type)",
          "CREATE INDEX idx_news_posts_status ON news_posts (status)",
          "CREATE INDEX idx_news_posts_created ON news_posts (created)",
          "CREATE INDEX idx_news_posts_category ON news_posts (category)",
        ],
      });
      app.save(col);
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("news_posts");
      app.delete(col);
    } catch (_) {}
  },
);
