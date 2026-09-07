/// <reference path="../pb_data/types.d.ts" />

// Every new staff account is created by an administrator, so it is trusted
// immediately: mark it verified before it is saved so the user can sign in
// without any email-verification step.
onRecordCreate((e) => {
  try {
    e.record.set("verified", true);
  } catch (err) {
    $app.logger().error("auto-verify failed", "err", String(err));
  }
  e.next();
}, "users");

// Safety net: if anything cleared the flag during creation, set it afterwards.
onRecordAfterCreateSuccess((e) => {
  try {
    if (!e.record.getBool("verified")) {
      e.record.set("verified", true);
      $app.save(e.record);
    }
  } catch (err) {
    $app.logger().error("auto-verify post-create failed", "err", String(err));
  }
  e.next();
}, "users");
