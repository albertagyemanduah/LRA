/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const logs = app.findCollectionByNameOrId("audit_logs");
    logs.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'";
    app.save(logs);

    const notifs = app.findCollectionByNameOrId("notifications");
    notifs.listRule = "@request.auth.id != '' && (@request.auth.id = user || @request.auth.role = 'admin')";
    notifs.viewRule = "@request.auth.id != '' && (@request.auth.id = user || @request.auth.role = 'admin')";
    notifs.deleteRule = "@request.auth.id != '' && (@request.auth.id = user || @request.auth.role = 'admin')";
    app.save(notifs);
  },
  (app) => {
    const logs = app.findCollectionByNameOrId("audit_logs");
    logs.deleteRule = null;
    app.save(logs);

    const notifs = app.findCollectionByNameOrId("notifications");
    notifs.listRule = "@request.auth.id != '' && @request.auth.id = user";
    notifs.viewRule = "@request.auth.id != '' && @request.auth.id = user";
    notifs.deleteRule = "@request.auth.id != '' && @request.auth.id = user";
    app.save(notifs);
  },
);
