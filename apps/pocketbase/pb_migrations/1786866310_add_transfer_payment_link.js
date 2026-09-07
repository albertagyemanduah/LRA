/// <reference path="../pb_data/types.d.ts" />

// Add a `transfer` relation field to the `payments` collection so a payment
// record can be linked directly to a land_transfer record, and add a
// "transfer_fee" option to the payments `purpose` select field.
migrate(
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    const transfers = app.findCollectionByNameOrId("land_transfers");

    // Add transfer relation field if it doesn't already exist
    if (!payments.fields.getByName("transfer")) {
      payments.fields.add(
        new RelationField({
          name: "transfer",
          collectionId: transfers.id,
          maxSelect: 1,
          minSelect: 0,
          cascadeDelete: false,
          required: false,
        }),
      );
    }

    // Add "transfer_fee" to the purpose select values if missing
    const purposeField = payments.fields.getByName("purpose");
    if (purposeField && Array.isArray(purposeField.values)) {
      if (!purposeField.values.includes("transfer_fee")) {
        purposeField.values = [...purposeField.values, "transfer_fee"];
      }
    }

    app.save(payments);
  },
  (app) => {
    const payments = app.findCollectionByNameOrId("payments");
    // Remove the transfer relation field
    const tf = payments.fields.getByName("transfer");
    if (tf) payments.fields.remove(tf);
    // Remove transfer_fee from purpose values
    const purposeField = payments.fields.getByName("purpose");
    if (purposeField && Array.isArray(purposeField.values)) {
      purposeField.values = purposeField.values.filter((v) => v !== "transfer_fee");
    }
    app.save(payments);
  },
);
