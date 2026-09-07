import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  Search, ShieldCheck, CheckCircle2, XCircle, RefreshCw,
  Calendar, ArrowLeft, Clock, KeyRound, Mail, Phone,
} from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" });
}

function VerificationResult({ result, timestamp }) {
  const isReg = result.status === "registered";
  return (
    <div className={cn("rounded-2xl border-2 shadow-md overflow-hidden", isReg ? "border-blue-300 bg-blue-50" : "border-border bg-card")}>
      <div className="flex items-start justify-between gap-4 p-5 border-b border-current/10">
        <div className="flex items-center gap-3">
          {isReg ? <CheckCircle2 className="h-8 w-8 text-blue-700 shrink-0" /> : <ShieldCheck className="h-8 w-8 text-primary shrink-0" />}
          <div>
            <h3 className="font-display text-lg font-bold">{isReg ? "Land Registered" : "Registration Pending"}</h3>
            <p className="text-sm text-muted-foreground">Land ID: {result.parcelNumber}</p>
          </div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold text-white uppercase", isReg ? "bg-blue-700" : "bg-primary/80")}>{result.status || "Unknown"}</span>
      </div>
      <div className="p-5">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
          {[
            { label: "Owner Name", value: result.applicantName },
            { label: "Plot Number", value: result.plotNumber },
            { label: "Block", value: result.block },
            { label: "Sector", value: result.sector },
            { label: "Community", value: result.community },
            { label: "Registration Date", value: formatDate(result.registrationDate), icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-start gap-2">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium">{value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t border-current/10 pt-3">
          <Clock className="h-3.5 w-3.5" />
          <span>Verified: {new Date(timestamp).toLocaleString("en-GH")}</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyLandPage() {
  // Step 1 — verification code
  const [codeInput, setCodeInput] = useState("");
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [validCode, setValidCode] = useState(null);

  // Hierarchy data
  const [allAreaCouncils, setAllAreaCouncils] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [allSectors, setAllSectors] = useState([]);
  const [hierLoading, setHierLoading] = useState(false);

  // Step 2 — search filters
  const [filterAC, setFilterAC] = useState("all");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [plotNumber, setPlotNumber] = useState("");
  const [block, setBlock] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [verifyTimestamp, setVerifyTimestamp] = useState(null);

  // Load hierarchy once code is validated
  const loadHierarchy = async (communityRef, isAdmin) => {
    setHierLoading(true);
    try {
      const [acs, comms, sects] = await Promise.all([
        pb.collection("area_councils").getFullList({ sort: "name", requestKey: "vlp-acs" }).catch(() => []),
        pb.collection("communities").getFullList({ sort: "name", requestKey: "vlp-comms" }).catch(() => []),
        pb.collection("sectors").getFullList({ sort: "name", requestKey: "vlp-sects" }).catch(() => []),
      ]);
      const active = (x) => x && !x.isDeleted && x.name;
      const activeAcs = acs.filter(active);
      const activeComms = comms.filter(active);
      const activeSects = sects.filter(active);

      if (isAdmin) {
        setAllAreaCouncils(activeAcs);
        setAllCommunities(activeComms);
        setAllSectors(activeSects);
      } else {
        // Filter to code's community and its area council
        const comm = activeComms.find((c) => c.name === communityRef);
        const filteredComms = comm
          ? activeComms.filter((c) => c.areaCouncil === comm.areaCouncil)
          : activeComms.filter((c) => c.name === communityRef);
        const acIds = new Set(filteredComms.map((c) => c.areaCouncil));
        const filteredAcs = activeAcs.filter((a) => acIds.has(a.id));
        setAllAreaCouncils(filteredAcs);
        setAllCommunities(filteredComms);
        setAllSectors(activeSects.filter((s) => filteredComms.some((c) => c.id === s.community)));
        // Pre-select community and its area council
        if (communityRef) {
          setFilterCommunity(communityRef);
          if (comm) {
            const ac = filteredAcs.find((a) => a.id === comm.areaCouncil);
            if (ac) setFilterAC(ac.name);
          }
        }
      }
    } catch (_) {}
    setHierLoading(false);
  };

  const validateCode = async () => {
    const c = codeInput.trim().toUpperCase();
    if (!c) { setCodeError("Please enter a verification code."); return; }
    if (!/^[A-Z0-9]{10}$/.test(c)) { setCodeError("Verification codes are 10 characters (letters and numbers only)."); return; }
    setCodeValidating(true);
    setCodeError("");
    setValidCode(null);
    setResults([]);
    setSearched(false);
    try {
      const res = await pb.send("/api/verify-code", { method: "POST", body: { code: c } });
      if (!res?.valid || !res?.code) {
        setCodeError(res?.error || "Invalid or expired verification code."); return;
      }
      setValidCode(res.code);
      const isAdmin = res.code.codeType === "admin";
      await loadHierarchy(res.code.communityRef, isAdmin);
    } catch (err) {
      setCodeError(err?.response?.error || err?.data?.error || "Invalid verification code. Please check and try again.");
    } finally {
      setCodeValidating(false);
    }
  };

  // Cascading helpers
  const visibleCommunities = filterAC !== "all"
    ? allCommunities.filter((c) => { const ac = allAreaCouncils.find((a) => a.name === filterAC); return ac ? c.areaCouncil === ac.id : true; })
    : allCommunities;

  const visibleSectors = filterCommunity !== "all"
    ? allSectors.filter((s) => { const comm = allCommunities.find((c) => c.name === filterCommunity); return comm ? s.community === comm.id : true; })
    : allSectors;

  const logVerification = async (code, communityRef, status, reason, count) => {
    try {
      await pb.collection("verification_logs").create({ code, communityRef: communityRef || "", status, reason: reason || "", searchFilters: { ac: filterAC, community: filterCommunity, sector: filterSector, plotNumber, block }, resultsCount: count });
    } catch (_) {}
  };

  const search = async () => {
    if (!validCode) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setSearched(false);
    const ts = Date.now();
    const isAdminCode = validCode.codeType === "admin";
    try {
      const filters = [];
      const params = {};

      if (!isAdminCode) {
        filters.push("community ~ {:community}");
        params.community = validCode.communityRef;
      }
      if (filterAC !== "all") { filters.push("areaCouncil ~ {:ac}"); params.ac = filterAC; }
      if (filterCommunity !== "all") { filters.push("community ~ {:community2}"); params.community2 = filterCommunity; }
      if (filterSector !== "all") { filters.push("sector ~ {:sector}"); params.sector = filterSector; }
      if (plotNumber.trim()) { filters.push("plotNumber ~ {:plot}"); params.plot = plotNumber.trim(); }
      if (block.trim()) { filters.push("block ~ {:block}"); params.block = block.trim().toUpperCase(); }

      const res = await pb.collection("parcels").getList(1, 50, {
        filter: filters.length ? pb.filter(filters.join(" && "), params) : "",
        requestKey: "vlp-search",
      });

      setVerifyTimestamp(ts);
      setSearched(true);
      setResults(res.items);
      await logVerification(validCode.code, validCode.communityRef, "success", "", res.items.length);
    } catch (err) {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const resetAll = () => {
    setCodeInput(""); setValidCode(null); setCodeError(""); setResults([]);
    setSearched(false); setFilterAC("all"); setFilterCommunity("all");
    setFilterSector("all"); setPlotNumber(""); setBlock(""); setSearchError("");
    setAllAreaCouncils([]); setAllCommunities([]); setAllSectors([]);
  };

  const acOptions = [{ value: "all", label: "All area councils" }, ...allAreaCouncils.map((a) => ({ value: a.name, label: a.name }))];
  const commOptions = [{ value: "all", label: "All communities" }, ...visibleCommunities.map((c) => ({ value: c.name, label: c.name }))];
  const sectOptions = [{ value: "all", label: "All sectors" }, ...visibleSectors.map((s) => ({ value: s.name, label: s.name }))];

  return (
    <>
      <Helmet>
        <title>Verify Land Registration — Techiman North Land Registry</title>
        <meta name="description" content="Verify land registration details for Techiman North District using a secure verification code." />
      </Helmet>
      <PublicNav />
      <main className="pt-16 min-h-screen bg-background pb-12">
        {/* Hero */}
        <div className="bg-primary px-5 py-14 text-center text-primary-foreground">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Verify Land Registration</h1>
            <p className="mt-3 text-base text-primary-foreground/80 leading-relaxed">
              Enter your verification code issued by the District Assembly, then search by Area Council, Community, Sector, Plot Number, or Block.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-primary-foreground/70">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure & Official</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Code-Protected Access</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Real-time Results</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-5 py-10 space-y-8">

          {/* Step 1 — Code entry */}
          {!validCode ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display text-lg font-semibold">Step 1 — Enter Verification Code</h2>
                  <p className="text-xs text-muted-foreground">Contact the Techiman North District Assembly to obtain a code.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Verification Code <span className="text-destructive">*</span></Label>
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4E5"
                  maxLength={10}
                  className={cn("font-mono uppercase tracking-widest text-center text-lg", codeError && "border-destructive")}
                  onKeyDown={(e) => e.key === "Enter" && validateCode()}
                />
                {codeError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" /> {codeError}
                  </div>
                )}
              </div>
              <Button onClick={validateCode} disabled={codeValidating || !codeInput.trim()} className="w-full sm:w-auto sm:min-w-[180px]">
                {codeValidating ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Validating…</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Validate Code</>}
              </Button>
            </div>
          ) : (
            <>
              {/* Code valid banner */}
              <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-blue-700 shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      Valid Code: <span className="font-mono">{validCode.code}</span>
                      {validCode.codeType === "admin" && (
                        <span className="ml-2 rounded-full bg-blue-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">District-wide</span>
                      )}
                    </p>
                    <p className="text-sm text-blue-800">
                      {validCode.codeType === "admin"
                        ? "Access: all registered lands in the district"
                        : <>Community: <strong>{validCode.communityRef}</strong></>}
                    </p>
                    {validCode.maxUsage > 0 && <p className="text-xs text-blue-700 mt-0.5">Usage: {validCode.usageCount}/{validCode.maxUsage}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={resetAll}>Change Code</Button>
              </div>

              {/* Step 2 — Search */}
              <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="font-display text-lg font-semibold">Step 2 — Search Land Records</h2>
                    <p className="text-xs text-muted-foreground">Use any combination of filters below. At least one filter is recommended.</p>
                  </div>
                </div>

                {hierLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Loading hierarchy…</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Area Council */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Area Council</Label>
                      <SearchableSelect
                        value={filterAC}
                        onValueChange={(v) => { setFilterAC(v); setFilterCommunity("all"); setFilterSector("all"); }}
                        options={acOptions}
                        placeholder="All area councils"
                        disabled={validCode.codeType !== "admin" && allAreaCouncils.length <= 1}
                      />
                    </div>
                    {/* Community */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Community</Label>
                      <SearchableSelect
                        value={filterCommunity}
                        onValueChange={(v) => { setFilterCommunity(v); setFilterSector("all"); }}
                        options={commOptions}
                        placeholder="All communities"
                      />
                    </div>
                    {/* Sector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Sector</Label>
                      <SearchableSelect
                        value={filterSector}
                        onValueChange={setFilterSector}
                        options={sectOptions}
                        placeholder="All sectors"
                      />
                    </div>
                    {/* Plot Number */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Plot Number</Label>
                      <Input
                        value={plotNumber}
                        onChange={(e) => setPlotNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ""))}
                        placeholder="e.g. 12"
                      />
                    </div>
                    {/* Block */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium">Block <span className="text-muted-foreground font-normal">(single character A–Z)</span></Label>
                      <Input
                        value={block}
                        onChange={(e) => setBlock(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 1))}
                        placeholder="e.g. A"
                        maxLength={1}
                        className="uppercase w-32"
                      />
                    </div>
                  </div>
                )}

                {searchError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" /> {searchError}
                  </div>
                )}
                <Button onClick={search} disabled={searching || hierLoading} className="min-w-[140px]">
                  {searching ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Searching…</> : <><Search className="mr-2 h-4 w-4" /> Search Land Records</>}
                </Button>
              </div>

              {/* Results */}
              {searched && (
                results.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 py-14 text-center">
                    <XCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-display text-lg font-semibold">No Results Found</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">No registered land matches your search criteria. Try adjusting your filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{results.length} land record(s) found</p>
                    {results.map((r) => <VerificationResult key={r.id} result={r} timestamp={verifyTimestamp} />)}
                  </div>
                )
              )}
            </>
          )}

          {/* Trust indicators */}
          <div className="grid gap-4 sm:grid-cols-3 text-center">
            {[
              { icon: ShieldCheck, title: "Official Registry", desc: "Data sourced directly from the Techiman North Land Registry database" },
              { icon: CheckCircle2, title: "Real-time Data", desc: "Verification results reflect the current state of land records" },
              { icon: Phone, title: "Need Help?", desc: "Contact our office for disputes, corrections or further assistance" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5">
                <Icon className="mx-auto h-8 w-8 text-primary mb-3" />
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Contact Us for Disputes or Codes
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-muted-foreground">
              <div><p className="font-medium text-foreground/80">Office</p><p>Techiman North District Assembly</p></div>
              <div><p className="font-medium text-foreground/80">Email</p><p>info@tenda.gov.gh</p></div>
              <div><p className="font-medium text-foreground/80">Region</p><p>Bono East Region, Ghana</p></div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button asChild variant="outline" size="sm"><Link to="/contact">Contact Office</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Home</Link></Button>
            </div>
          </div>
        </div>
      </main>
      <StickyFooter />
    </>
  );
}
