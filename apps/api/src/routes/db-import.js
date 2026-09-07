import logger from "../utils/logger.js";

/** Split a VALUES(...) tuple respecting quotes. */
function splitValues(str) {
  const out = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "'" && str[i + 1] === "'") { cur += "'"; i++; continue; }
      if (ch === "'") { inStr = false; continue; }
      cur += ch;
    } else if (ch === "'") {
      inStr = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map((v) => (v === "NULL" ? null : v));
}

function parseSQL(sql) {
  const tables = {};
  const insertRe = /INSERT\s+INTO\s+[`"]?([A-Za-z0-9_]+)[`"]?\s*\(([^)]+)\)\s*VALUES\s*\((.*?)\);/gis;
  let m;
  while ((m = insertRe.exec(sql)) !== null) {
    const [, tbl, colsRaw, valsRaw] = m;
    const cols = colsRaw.split(",").map((c) => c.trim().replace(/[`"]/g, ""));
    const vals = splitValues(valsRaw);
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i] ?? null; });
    (tables[tbl] ||= []).push(row);
  }
  return tables;
}

export default async (req, res) => {
  const { sql, dryRun } = req.body || {};
  const isDryRun = dryRun === true || req.query.dryRun === "true";

  if (!sql || typeof sql !== "string") {
    return res.status(422).json({ error: "sql body field is required" });
  }
  if (sql.length > 60 * 1024 * 1024) {
    return res.status(422).json({ error: "SQL file too large (max 60MB)" });
  }

  const tables = parseSQL(sql);
  const tableNames = Object.keys(tables);

  if (tableNames.length === 0) {
    return res.status(422).json({ error: "No INSERT statements found in the SQL file" });
  }

  const summary = tableNames.map((t) => ({
    table: t,
    rows: tables[t].length,
    columns: Object.keys(tables[t][0] || {}),
  }));

  if (isDryRun) {
    return res.json({ dryRun: true, tables: summary, totalRows: summary.reduce((a, b) => a + b.rows, 0) });
  }

  const { default: pb } = await import("../utils/pocketbaseClient.js");

  const results = [];
  for (const name of tableNames) {
    let created = 0, updated = 0, failed = 0;
    const errors = [];
    for (const row of tables[name]) {
      const data = { ...row };
      const id = data.id;
      delete data.created;
      delete data.updated;
      try {
        if (id) {
          try {
            await pb.collection(name).update(id, data);
            updated++;
            continue;
          } catch {
            // not found — fall through to create
          }
        }
        await pb.collection(name).create(data);
        created++;
      } catch (err) {
        failed++;
        if (errors.length < 10) errors.push({ id: id || null, error: err.message });
      }
    }
    logger.info(`SQL import ${name}: +${created} ~${updated} !${failed}`);
    results.push({ table: name, created, updated, failed, errors });
  }

  res.json({ dryRun: false, results });
};
