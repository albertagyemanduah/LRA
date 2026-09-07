import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

function pageWindow(current, total) {
  const pages = [];
  const push = (p) => { if (!pages.includes(p) && p >= 1 && p <= total) pages.push(p); };
  push(1);
  for (let i = current - 1; i <= current + 1; i++) push(i);
  push(total);
  const out = [];
  let prev = 0;
  for (const p of pages.sort((a, b) => a - b)) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Reusable, responsive, accessible pagination control.
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  if (!totalRecords) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalRecords);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Showing <strong className="text-foreground">{from}–{to}</strong> of{" "}
          <strong className="text-foreground">{totalRecords}</strong>
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Rows:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="First page"
          disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page"
          disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageWindow(currentPage, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-xs font-medium transition",
                p === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {p}
            </button>
          )
        )}
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page"
          disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Last page"
          disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

/** Hook: paginated slice + localStorage-persisted page size. */
export function usePagination(records, storageKey = "tnda-page-size", defaultSize = 25) {
  const [pageSize, setPageSize] = React.useState(() => {
    const s = Number(localStorage.getItem(storageKey));
    return PAGE_SIZES.includes(s) ? s : defaultSize;
  });
  const [page, setPage] = React.useState(1);
  const total = records?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const changeSize = (s) => {
    setPageSize(s);
    localStorage.setItem(storageKey, String(s));
    setPage(1);
  };

  const pageItems = (records || []).slice((page - 1) * pageSize, page * pageSize);

  return {
    page, setPage, pageSize, setPageSize: changeSize,
    totalPages, totalRecords: total, pageItems,
  };
}
