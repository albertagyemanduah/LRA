import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPinned, SearchCheck, FileText, ClipboardList, Compass, Wallet, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";

const HERO = "https://images.hostinger.com/be655138-806c-4137-85f0-2f9e6569c1a8.png";

const SERVICES = [
  {
    icon: MapPinned, title: "Land Registration", fee: "GHS 250",
    description: "Register your land parcel with full ownership records, parcel numbers, and official certification. The registration process involves verification of ownership documents, cadastral survey, and issuance of a land title certificate.",
    requirements: ["Ghana Card (National ID)", "Site plan / survey report", "Deed of assignment or allocation letter", "Proof of purchase or inheritance", "Two passport photographs"],
    process: ["Submit application with documents", "Planning officer review", "Cadastral survey", "Registrar review", "Certificate issuance"],
  },
  {
    icon: SearchCheck, title: "Title Search & Verification", fee: "GHS 50",
    description: "Verify land ownership, check for encumbrances, disputes, or liens, and obtain an official title search certificate for any parcel in the district. Essential for property transactions and due diligence.",
    requirements: ["Plot number or land ID", "Location details (Area Council, community)", "Applicant Ghana Card"],
    process: ["Submit search request", "Registry database search", "Encumbrance check", "Verification certificate issued"],
  },
  {
    icon: FileText, title: "Document Management", fee: "Varies",
    description: "Securely store, manage, and retrieve all land-related documents including deeds, indentures, site plans, and certificates. Documents are digitized, version-controlled, and accessible to authorized parties.",
    requirements: ["Original documents for scanning", "Ghana Card of applicant", "Land ID or plot reference"],
    process: ["Submit documents for scanning", "Document digitization", "Verification", "Secure digital storage"],
  },
  {
    icon: ClipboardList, title: "Land Transfer", fee: "GHS 300–500",
    description: "Process the legal transfer of land ownership from one party to another with a complete audit trail, multi-level approval workflow, and issuance of a transfer certificate.",
    requirements: ["Transfer deed / indenture", "Both parties' Ghana Cards", "Original title certificate", "Evidence of consideration (purchase price)"],
    process: ["Submit transfer application", "Planning officer review", "Physical Planning approval", "Administrator approval", "Transfer certificate issued"],
  },
  {
    icon: Compass, title: "Cadastral Survey", fee: "GHS 400+",
    description: "Commission professional land surveys with GPS coordinates, boundary delineation, and boundary beacon placement. Survey reports are certified and stored in the district cadastral database.",
    requirements: ["Land allocation letter or title", "Ghana Card of applicant", "Access to the land for survey"],
    process: ["Survey request submitted", "Survey scheduled", "Field survey conducted", "GPS data processed", "Survey report certified"],
  },
  {
    icon: Wallet, title: "Fee Payment", fee: "Various",
    description: "Pay all land-related fees conveniently via Mobile Money, debit/credit card, bank transfer, or cash at the district office. Instant receipts generated for all payments.",
    requirements: ["Valid invoice from the registry", "Payment method (Mobile Money / card / cash)"],
    process: ["Receive invoice", "Select payment method", "Make payment", "Receive official receipt"],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-background pb-12">
      <PublicNav />

      {/* Hero */}
      <section className="relative flex items-center overflow-hidden pt-16 min-h-[40vh]">
        <div className="absolute inset-0">
          <img src={HERO} alt="Land services" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/60" />
        </div>
        <div className="relative mx-auto max-w-[80rem] px-5 py-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Our Services</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">Land Administration Services</h1>
            <p className="mt-4 max-w-xl text-lg text-primary-foreground/80">
              Comprehensive land management services for the Techiman North District.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-[80rem] px-5 py-20 space-y-10">
        {SERVICES.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.4 }}
            className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className={`grid lg:grid-cols-[1fr_1.5fr] ${i % 2 === 1 ? "lg:direction-rtl" : ""}`}>
              <div className="bg-primary/5 p-8 flex flex-col justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
                  <s.icon className="h-7 w-7" strokeWidth={1.8} />
                </span>
                <h2 className="font-display text-2xl font-bold">{s.title}</h2>
                <div className="mt-3 inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-blue-700">
                  Starting from {s.fee}
                </div>
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Requirements</p>
                  <ul className="space-y-1.5">
                    {s.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="p-8">
                <p className="text-muted-foreground leading-relaxed">{s.description}</p>
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Process</p>
                  <div className="space-y-2">
                    {s.process.map((step, idx) => (
                      <div key={step} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                          {idx + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="mx-auto max-w-[80rem] px-5 py-14 text-center">
          <h2 className="font-display text-2xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-2 text-primary-foreground/75">Contact the district office or log in to the staff portal to begin.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/contact">Contact Us <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link to="/auth">Staff Login</Link>
            </Button>
          </div>
        </div>
      </section>

      <StickyFooter />
    </div>
  );
}
