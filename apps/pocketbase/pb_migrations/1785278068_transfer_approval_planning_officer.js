/// <reference path="../pb_data/types.d.ts" />

// Update land_transfers: remove registrar from approval, only admin and planning_officer can approve/reject

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("land_transfers");
    col.listRule = "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'planning_officer')";
    col.viewRule = "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'planning_officer')";
    col.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'planning_officer')";
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("land_transfers");
    col.listRule = "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'registrar' || @request.auth.role = 'planning_officer')";
    col.viewRule = "@request.auth.id != '' && (@request.auth.id = fromOwner || @request.auth.role = 'admin' || @request.auth.role = 'registrar' || @request.auth.role = 'planning_officer')";
    col.updateRule = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'registrar')";
    app.save(col);
  }
);
