/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // No verification gate on sign-in — accounts are created by administrators.
    users.authRule = "";
    if (users.verificationTemplate) {
      // keep template as-is; nothing to change
    }
    app.save(users);

    // Backfill: mark every existing account as verified so nobody is locked out.
    app.db()
      .newQuery("UPDATE users SET verified = true WHERE verified = false OR verified IS NULL")
      .execute();
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authRule = "";
    app.save(users);
  }
);
