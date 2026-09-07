import React, { useState } from "react";
import { SearchCheck, Search, ShieldCheck, AlertTriangle, Download, Bookmark, Clock, ChevronDown, X, Filter, FileText, Users, CreditCard } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusBadge, EmptyState } from "@/components/shared";
import { titleCase, formatDate } from "@/lib/format";
import { getUserAreaCouncils, filterParcelsForUser } from "@/lib/offices";
import { useHierarchy } from "@/hooks/useHierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUSES = ["all", "draft", "submitted", "under_survey", "under_review", "registered", "disputed", "rejected"];

export default function SearchPage() {
  const { user, role, log } = useAuth();
  const userACs = getUserAreaCouncils(user);
  const { toast } = useToast();
  const { offices, acForOffice, commForAC, sectForComm } = useHierarchy();

  const [officeFilter, setOfficeFilter] = useState("all");
  const [communityHierFilter, setCommunityHierFilter] = useState("all");
  const [sectorHierFilter, setSectorHierFilter] = useState("all");

  // Land search state
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acFilter, setAcFilter] = useState("all");
  const [communityFilter, setCommunityFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [plotFilter, setPlotFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState(null);

  // Derived hierarchy options
  const hierACs = officeFilter !== "all" ? acForOffice(officeFilter) : [];
  const hierComms = acFilter !== "all" ? commForAC(acFilter) : [];
  const hierSects = communityHierFilter !== "all" ? sectForComm(communityHierFilter) : [];
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("lands");

  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tnda-saved-searches") || "[]"); } catch { return []; }
  });
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tnda-search-history") || "[]"); } catch { return []; }
  });

  const saveSearch = () => {
    const label = q || "Advanced search";
    const existing = JSON.parse(localStorage.getItem("tnda-saved-searches") || "[]");
    const saved = [{ label, params: { q, statusFilter, acFilter, communityFilter, sectorFilter }, at: new Date().toISOString() }, ...existing.slice(0, 9)];
    localStorage.setItem("tnda-saved-searches", JSON.stringify(saved));
    setSavedSearches(saved);
    toast({ title: "Search saved" });
  };

  const addHistory = (term, count) => {
    const existing = JSON.parse(localStorage.getItem("tnda-search-history") || "[]");
    const hist = [{ term, count, at: new Date().toISOString() }, ...existing.filter((h) => h.term !== term).slice(0, 9)];
    localStorage.setItem("tnda-search-history", JSON.stringify(hist));
    setSearchHistory(hist);
  };

  const runSearch = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try {
      const filters = [];
      if (q.trim()) {
        filters.push(`parcelNumber ~ {:q} || applicantName ~ {:q} || community ~ {:q} || sector ~ {:q} || plotNumber ~ {:q} || areaCouncil ~ {:q} || block ~ {:q} || contactPhone ~ {:q}`);
      }
      if (statusFilter !== "all") filters.push(`status = "${statusFilter}"`);
      if (acFilter !== "all") filters.push(`areaCouncil = "${acFilter}"`);
      if (officeFilter !== "all") filters.push(`office = "${officeFilter}"`);
      if (communityHierFilter !== "all") filters.push(`community = "${communityHierFilter}"`);
      if (sectorHierFilter !== "all") filters.push(`sector = "${sectorHierFilter}"`);
      if (communityFilter.trim()) filters.push(`community ~ {:comm}`);
      if (sectorFilter.trim()) filters.push(`sector ~ {:sect}`);
      if (ownerFilter.trim()) filters.push(`applicantName ~ {:own}`);
      if (plotFilter.trim()) filters.push(`plotNumber = {:plot}`);
      if (blockFilter.trim()) filters.push(`block = {:blk}`);
      if (dateFrom) filters.push(`registrationDate >= "${dateFrom}"`);
      if (dateTo) filters.push(`registrationDate <= "${dateTo}"`);

      const filterStr = filters.length > 0
        ? pb.filter(filters.join(" && "), {
            q: q.trim() || "%",
            comm: communityFilter.trim(),
            sect: sectorFilter.trim(),
            own: ownerFilter.trim(),
            plot: plotFilter.trim(),
            blk: blockFilter.trim(),
          })
        : undefined;

      let list = await pb.collection("parcels").getFullList({
        filter: filterStr, expand: "owner", sort: "-created", requestKey: "search-lands"
      });
      list = filterParcelsForUser(user, list);
      setResults(list);
      if (q.trim()) addHistory(q.trim(), list.length);
      await log("title_search", "parcels", `Query: "${q}" filters: status=${statusFilter},AC=${acFilter} (${list.length} results)`);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!results?.length) return;
    const rows = [["Land ID", "Owner Name", "Plot No", "Block", "Area Council", "Community", "Sector", "Registration Date", "Status", "Mobile", "Email"]];
    results.forEach((p) => rows.push([
      p.parcelNumber, p.applicantName || "—", p.plotNumber || "—", p.block || "—",
      p.areaCouncil || "—", p.community || "—", p.sector || "—",
      p.registrationDate ? formatDate(p.registrationDate) : "—",
      titleCase(p.status || ""), p.contactPhone || "—", p.applicantEmail || "—",
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "tnda-search-results.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [
    q !== "", statusFilter !== "all", acFilter !== "all", officeFilter !== "all",
    communityHierFilter !== "all", sectorHierFilter !== "all",
    communityFilter !== "", sectorFilter !== "", ownerFilter !== "",
    plotFilter !== "", blockFilter !== "", dateFrom !== "", dateTo !== ""
  ].filter(Boolean).length;

  const clearAll = () => {
    setQ(""); setStatusFilter("all"); setAcFilter("all"); setOfficeFilter("all"); setCommunityHierFilter("all"); setSectorHierFilter("all");
    setCommunityFilter(""); setSectorFilter(""); setOwnerFilter(""); setPlotFilter(""); setBlockFilter(""); setDateFrom(""); setDateTo(""); setResults(null);
  };

  return (
    <>
      <PageHeader title="Search & Verification" subtitle="Search all land records, verify ownership and registration status" icon={SearchCheck} />

      {/* Search panel */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by Land ID, owner name, plot number, community, sector…" className="pl-9" />
          </div>
          <Button type="submit" disabled={loading} className="shrink-0">{loading ? "Searching…" : "Search"}</Button>
          <Button type="button" variant="outline" className="shrink-0" onClick={() => setShowAdvanced((v) => !v)}>
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && <span className="ml-1.5 rounded-full bg-primary text-white text-[10px] px-1.5 py-0.5">{activeFilterCount}</span>}
            <ChevronDown className={cn("ml-1 h-4 w-4 transition", showAdvanced && "rotate-180")} />
          </Button>
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-red-600 hover:text-red-800">
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </form>

        {showAdvanced && (
          <div className="border-t border-border pt-4 space-y-3">
            {/* Hierarchy cascade filters */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">Hierarchy Filters</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Office</Label>
                  <Select value={officeFilter} onValueChange={(v) => { setOfficeFilter(v); setAcFilter("all"); setCommunityHierFilter("all"); setSectorHierFilter("all"); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All offices</SelectItem>
                      {offices.filter((o) => o && o.name).map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Area Council</Label>
                  <Select value={acFilter} onValueChange={(v) => { setAcFilter(v); setCommunityHierFilter("all"); setSectorHierFilter("all"); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All area councils</SelectItem>
                      {(officeFilter !== "all" ? hierACs : acForOffice("")).filter((a) => a && a.name).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Community</Label>
                  <Select value={communityHierFilter} onValueChange={(v) => { setCommunityHierFilter(v); setSectorHierFilter("all"); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All communities</SelectItem>
                      {hierComms.filter((c) => c && c.name).map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sector</Label>
                  <Select value={sectorHierFilter} onValueChange={setSectorHierFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sectors</SelectItem>
                      {hierSects.filter((s) => s && s.name).map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((v) => <SelectItem key={v} value={v}>{v === "all" ? "Any status" : titleCase(v.replace("_", " "))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Area Council</Label>
                <Select value={acFilter} onValueChange={setAcFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any area council</SelectItem>
                    {acForOffice("").map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Community</Label>
                <Input value={communityFilter} onChange={(e) => setCommunityFilter(e.target.value)}
                  placeholder="Filter by community" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sector</Label>
                <Input value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
                  placeholder="Filter by sector" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Owner Name</Label>
                <Input value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}
                  placeholder="Filter by owner name" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plot Number</Label>
                <Input value={plotFilter} onChange={(e) => setPlotFilter(e.target.value)}
                  placeholder="Exact plot number" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Block</Label>
                <Input value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}
                  placeholder="Block identifier" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Registration Date From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Registration Date To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved searches & history — shown when no results yet */}
      {results === null && (
        <div className="grid gap-6 lg:grid-cols-2">
          {savedSearches.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5"><Bookmark className="h-4 w-4 text-primary" /> Saved searches</h3>
              <ul className="space-y-2">
                {savedSearches.map((s, i) => (
                  <li key={i}>
                    <button onClick={() => { setQ(s.params.q || ""); setStatusFilter(s.params.statusFilter || "all"); setAcFilter(s.params.acFilter || "all"); runSearch(); }}
                      className="w-full text-left rounded-lg bg-muted/40 px-3 py-2.5 text-sm hover:bg-muted/70 transition">
                      <p className="font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(s.at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {searchHistory.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> Recent searches</h3>
              <ul className="space-y-1.5">
                {searchHistory.map((h, i) => (
                  <li key={i}>
                    <button onClick={() => { setQ(h.term); runSearch(); }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/40 transition">
                      <span className="font-medium">{h.term}</span>
                      <span className="text-xs text-muted-foreground">{h.count} result{h.count !== 1 ? "s" : ""} · {formatDate(h.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground font-medium">
              <span className="text-foreground font-semibold">{results.length}</span> record{results.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex flex-wrap gap-2">
              {results.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={saveSearch}>
                    <Bookmark className="mr-1 h-3.5 w-3.5" /> Save search
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setResults(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No matching records"
              message="No registered parcel matches your search. Try adjusting the filters or search term." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Land ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Plot / Block</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Area Council</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Community</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Reg. Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((p, i) => {
                    const isRegistered = p.status === "registered";
                    const isDisputed = p.status === "disputed";
                    return (
                      <tr key={p.id} className={cn("border-b border-border transition hover:bg-muted/30",
                        i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                        <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{p.parcelNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.applicantName || "—"}</div>
                          {p.contactPhone && <div className="text-xs text-muted-foreground">{p.contactPhone}</div>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {p.plotNumber && p.block ? `${p.plotNumber} / ${p.block}` : p.plotNumber || p.block || "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.areaCouncil || "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.community || "—"}</td>
                        <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                          {p.registrationDate ? formatDate(p.registrationDate) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                              <ShieldCheck className="h-3 w-3" /> Verified
                            </span>
                          ) : isDisputed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                              <AlertTriangle className="h-3 w-3" /> Disputed
                            </span>
                          ) : (
                            <StatusBadge status={p.status} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
