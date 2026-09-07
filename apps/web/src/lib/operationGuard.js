// Tracks active long-running operations (bulk delete, data upload, etc.)
// so the inactivity logout timer can pause while they are running.

let activeCount = 0;

export function startOperation() {
  activeCount++;
}

export function endOperation() {
  activeCount = Math.max(0, activeCount - 1);
}

export function isOperationActive() {
  return activeCount > 0;
}
