/**
 * SQL Export / Import helpers — talk to the Express /db/export and /db/import routes
 */
import apiServerClient from "@/lib/apiServerClient";

/**
 * Download the database as a .sql file.
 * @param {object} opts
 * @param {string} opts.scope  "schema" | "data" | "schema+data"
 * @param {boolean} opts.includeHidden  include soft-deleted parcels
 * @param {string|null} opts.table  specific table, or null for all
 */
export async function downloadSQL({ scope = "schema+data", includeHidden = true, table = null } = {}) {
  const params = new URLSearchParams({ scope, includeHidden: String(includeHidden) });
  if (table) params.set("table", table);

  const resp = await apiServerClient.fetch(`/db/export?${params}`, { method: "GET" });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.statusText);
    throw new Error(`Export failed: ${resp.status} — ${txt}`);
  }
  const sql = await resp.text();

  // Read filename from Content-Disposition header
  const cd = resp.headers.get("Content-Disposition") || "";
  const fnMatch = cd.match(/filename="?([^";\n]+)"?/);
  const filename = fnMatch ? fnMatch[1] : `db_export_${Date.now()}.sql`;

  // Trigger browser download
  const blob = new Blob([sql], { type: "application/sql" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, bytes: sql.length };
}

/**
 * Preview an SQL import (dry-run) — returns table/row summary.
 */
export async function previewSQLImport(sqlText) {
  const resp = await apiServerClient.fetch("/db/import?dryRun=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: sqlText, dryRun: true }),
  });
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    throw new Error(j.error || `Preview failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Execute an SQL import.
 */
export async function executeSQLImport(sqlText) {
  const resp = await apiServerClient.fetch("/db/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: sqlText }),
  });
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    throw new Error(j.error || `Import failed: ${resp.status}`);
  }
  return resp.json();
}
