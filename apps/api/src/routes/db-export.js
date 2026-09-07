import logger from "../utils/logger.js";

const SKIP = new Set(["_superusers", "_mfas", "_otps", "_externalAuths", "_authOrigins"]);

function esc(val) {
  if (val === null || val === undefined || val === "") return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "object") return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function sqlType(f) {
  switch (f.type) {
    case "number": return "REAL";
    case "bool": return "INTEGER";
    default: return "TEXT";
  }
}

export default async (req, res) => {
  const { scope = "schema+data", includeHidden = "true", table } = req.query;
  if (!["schema", "data", "schema+data"].includes(scope)) {
    return res.status(422).json({ error: "scope must be schema, data or schema+data" });
  }
  const exportSchema = scope !== "data";
  const exportData = scope !== "schema";
  const inclHidden = includeHidden !== "false";

  const { default: pb } = await import("../utils/pocketbaseClient.js");

  const collections = (await pb.collections.getFullList({ batch: 200 }))
    .filter((c) => c.type !== "view" && !SKIP.has(c.name) && (!table || c.name === table));

  if (table && collections.length === 0) {
    return res.status(422).json({ error: `Unknown table: ${table}` });
  }

  const ts = new Date().toISOString();
  const lines = [
    "-- =====================================================",
    "-- TeNDA PPD Land Registry — SQL Export",
    `-- Generated: ${ts}`,
    `-- Scope: ${scope}  |  Include hidden: ${inclHidden}`,
    `-- Tables: ${collections.map((c) => c.name).join(", ")}`,
    "-- =====================================================",
    "",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "START TRANSACTION;",
    "",
  ];

  let totalRows = 0;

  for (const col of collections) {
    const fields = (col.fields || col.schema || []).filter((f) => !f.hidden);
    const colNames = ["id", ...fields.map((f) => f.name), "created", "updated"];

    if (exportSchema) {
      lines.push(`-- Table: ${col.name}`);
      lines.push(`DROP TABLE IF EXISTS \`${col.name}\`;`);
      const defs = [
        "  `id` VARCHAR(15) NOT NULL",
        ...fields.map((f) => `  \`${f.name}\` ${sqlType(f)}${f.required ? " NOT NULL" : ""}`),
        "  `created` TEXT",
        "  `updated` TEXT",
        "  PRIMARY KEY (`id`)",
      ];
      lines.push(`CREATE TABLE \`${col.name}\` (\n${defs.join(",\n")}\n);`);
      lines.push("");
    }

    if (exportData) {
      let records = [];
      try {
        const opts = { batch: 500, sort: "created" };
        if (!inclHidden && col.name === "parcels") opts.filter = "isDeleted != true";
        records = await pb.collection(col.name).getFullList(opts);
      } catch (err) {
        logger.warn(`Skipping data for ${col.name}: ${err.message}`);
        records = [];
      }

      if (records.length) {
        totalRows += records.length;
        lines.push(`-- Data for: ${col.name} (${records.length} rows)`);
        const cols = colNames.map((c) => `\`${c}\``).join(", ");
        for (const r of records) {
          const vals = colNames.map((c) => esc(r[c])).join(", ");
          lines.push(`INSERT INTO \`${col.name}\` (${cols}) VALUES (${vals});`);
        }
        lines.push("");
      }
    }
  }

  lines.push("COMMIT;");
  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("");
  lines.push(`-- Export complete. Tables: ${collections.length}, Rows: ${totalRows}`);

  const sql = lines.join("\n");
  const fileName = `tenda_ppd_export_${ts.replace(/[:.]/g, "-").slice(0, 19)}.sql`;

  res.setHeader("Content-Type", "application/sql; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Tables, X-Export-Rows");
  res.setHeader("X-Export-Tables", String(collections.length));
  res.setHeader("X-Export-Rows", String(totalRows));
  logger.info(`SQL export: ${collections.length} tables, ${totalRows} rows, ${sql.length} bytes`);
  res.send(sql);
};
