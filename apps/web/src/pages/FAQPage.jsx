import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";
import { cn } from "@/lib/utils";

const FAQS = [
  // ── General ───────────────────────────────────────────────
  { cat: "General", q: "Who can use the Techiman North Land Registry System?", a: "The system is for authorized district staff including Planning Officers, Surveyors, Land Registrars, Finance Officers, and District Administrators. Staff accounts are created by the District Assembly Administrator." },
  { cat: "General", q: "What are the Area Councils covered by the system?", a: "The system covers all five Area Councils in the Techiman North District: Tuobodom, Offuman, Aworowa, Buoyem, and Krobo." },
  { cat: "General", q: "Is the system available 24/7?", a: "The online system is available 24/7 for staff login and record viewing. However, physical office services are available Monday–Friday, 8:00am–5:00pm." },
  { cat: "General", q: "Can I access the system on my phone?", a: "Yes. The platform is a Progressive Web App (PWA) — install it from your browser for a full mobile experience with offline support." },

  // ── Features ──────────────────────────────────────────────
  { cat: "Features", q: "What are the major features of the Land Registry System?", a: "The platform brings together land registration, separate multiple-land records, an administrative hierarchy (Office → Area Council → Community → Sector), automatic parcel ID assignment and correction, land transfers with approval workflows, amendments, a centralized approvals workspace, payments and invoices, certificates, reports and analytics, bulk import and export, real-time notifications and SMS, ownership history tracking, role-based access control, immutable audit trails, a public land verification portal, in-app chat, support tickets, and offline/real-time synchronization." },
  { cat: "Features", q: "How does the system handle an owner with more than one land?", a: "When an owner registers a main land plus additional lands, the system creates a separate parcel record for each land. Every land gets its own unique Land ID, status, audit trail, and can be searched, transferred, amended, exported, and verified independently — while the owner is registered once and their identity is shared across all their parcels." },
  { cat: "Features", q: "What is the administrative hierarchy used for?", a: "Every parcel is linked to an Office, Area Council, Community, and Sector. This hierarchy drives cascading dropdowns during registration, filters and reports, role-based scoping (officers see lands within their assigned area), and the public verification portal. It keeps records organized and consistent across the district." },
  { cat: "Features", q: "What is the parcel ID format and how is it assigned?", a: "Each parcel receives an automatic, sequential Land ID in the format TeNDA-PPD-[COMMUNITY ABBREVIATION]-XXXX (for example, TeNDA-PPD-ADUM-0001). The abbreviation is the first four letters of the community name, uppercased. IDs are generated during registration and import." },
  { cat: "Features", q: "What is the Parcel ID Correction tool?", a: "It is an Administrator-only tool that scans all parcel records, detects malformed, duplicate, or community-mismatched Land IDs, and previews the correct TeNDA-PPD-XXXX format. Admins can correct selected parcels or all of them in batches with a live progress bar, safe cancellation, retry for failures, and full audit logging. Related payment records are synced automatically." },
  { cat: "Features", q: "How do land transfers work?", a: "The current registered owner initiates a transfer request with the new owner's details and a transfer letter. The request is reviewed and approved or rejected by a Physical Planning Officer or District Assembly Administrator. On approval, ownership updates, a transfer certificate is generated, an ownership-history entry is recorded, and both parties are notified by SMS." },
  { cat: "Features", q: "What is an amendment and how is it approved?", a: "An amendment is a request to change details on an existing parcel. Staff who cannot edit directly submit an amendment request; Planning Officers and Administrators can edit directly or review submitted requests. All amendments are logged in the audit trail and trigger notifications to the relevant approvers." },
  { cat: "Features", q: "What is the Approvals workspace?", a: "The Approvals module is a single, centralized queue where Planning Officers and Administrators review and act on land edit, delete, and transfer requests. You can approve, reject, request more information, edit pending transfers, filter by type and status, and (for Admins) permanently delete rejected approvals. A red blinking indicator on the dashboard alerts approvers to pending items." },
  { cat: "Features", q: "How does the public land verification portal work?", a: "Members of the public can verify land registration using a secure verification code issued by the District Assembly. After entering the code, they search by Area Council, Community, Sector, Plot Number, or Block. The portal displays only public fields — Land ID, status, owner name, plot, block, sector, community, and registration date. Private details, fees, and additional lands are never exposed." },
  { cat: "Features", q: "What payment features does the system offer?", a: "Finance Officers create invoices and record payments linked to specific parcels, with charge types such as registration, search, survey, processing, ground rent, penalty, and transfer fees. Payments support mobile money, card, bank transfer, and cash methods. Receipts can be downloaded as PDF or Word documents, and financial reports provide summaries, breakdowns, and year-on-year analysis." },
  { cat: "Features", q: "What reports and analytics are available?", a: "The Reports module provides overview statistics, community and area council breakdowns, office performance, and monthly/yearly trends for registrations, revenue, and workflows. The dashboard adds AI-powered insights, year-on-year gauges, and exportable statistics. Ownership Analytics offers transfer reports, owner activity, geographic and temporal analysis, and bulk exports." },
  { cat: "Features", q: "Can I import and export data in bulk?", a: "Yes. Administrators can bulk-import land records from CSV, XLS, and XLSX files with validation, intelligent date parsing, auto plot/block splitting, and a real-time progress report. All staff can export parcels to CSV, XLS, XLSX, PDF, and SQL formats, with filters applied. Reports and audit trails are also exportable." },
  { cat: "Features", q: "How do notifications work?", a: "The system sends real-time in-app notifications and SMS alerts for registrations, transfers, amendments, approvals, rejections, and reminders. SMS is sent to all contact numbers on a parcel (except the WhatsApp number). Users can customize notification preferences, channels, frequency, and quiet hours from their settings." },
  { cat: "Features", q: "What is ownership history?", a: "Every parcel keeps a complete, immutable chain of custody. You can view all previous owners with dates and transfer reasons from the parcel's History view, and export it for legal purposes. Once recorded, history cannot be altered." },
  { cat: "Features", q: "How does role-based access control work?", a: "Each staff account is assigned one or more roles (Planning Officer, Survey Officer, Registrar, Finance Officer, Administrator, Customary Secretariat). Modules, records, and actions are gated by role. Officers are also scoped to their assigned office, area council, community, or sector, so they only see lands within their jurisdiction. Multi-role users can switch roles from the header." },
  { cat: "Features", q: "Are all actions recorded?", a: "Yes. The system maintains an immutable audit trail logging every registration, transfer, amendment, approval, deletion, status change, parcel ID correction, and administrative action with the actor, timestamp, and details. Admins can review and export the audit trail." },
  { cat: "Features", q: "Does the system work offline?", a: "As a Progressive Web App, the platform supports offline access for previously loaded data and syncs automatically when connectivity returns. Real-time updates push changes to all connected users immediately through live subscriptions." },
  { cat: "Features", q: "Can staff communicate within the system?", a: "Yes. The built-in chat allows direct, real-time messaging between staff members with message history and read receipts. Support tickets handle formal issue reporting, feature requests, and data corrections, with categories, priorities, attachments, and status tracking." },

  // ── Registration ──────────────────────────────────────────
  { cat: "Registration", q: "What documents do I need to register land?", a: "You typically need a site plan, Ghana Card identification, proof of ownership (deed/indenture or allocation letter), and any relevant customary documentation. The system supports uploading all document types securely." },
  { cat: "Registration", q: "How long does land registration take?", a: "The process typically takes 5–14 working days depending on the complexity of the application. Applications with complete documentation and no disputes are processed faster." },
  { cat: "Registration", q: "Can I register land that was given to me by my family or chief?", a: "Yes. Customary land grants and family allocations can be registered. You will need documentation of the customary allocation, witnesses, and a site plan. The Customary Land Secretariat can assist with customary land documentation." },
  { cat: "Registration", q: "What is a Land ID and how is it assigned?", a: "A Land ID (e.g., TeNDA-PPD-ADUM-0001) is a unique identifier assigned automatically to each registered parcel. It follows the format TeNDA-PPD-[COMMUNITY ABBREVIATION]-XXXX and is used for all subsequent transactions related to that parcel." },
  { cat: "Registration", q: "Can I register several lands for one owner at the same time?", a: "Yes. The registration form lets you add additional lands, each with its own Area Council, Community, Sector, Plot Number, and Block. Each land is saved as a separate parcel with its own Land ID while sharing the owner's identity." },

  // ── Payment ───────────────────────────────────────────────
  { cat: "Payment", q: "What payment methods are accepted?", a: "The system records payments made via Mobile Money, bank transfers, card, and cash at the district office. All payment processing is managed by Finance Officers." },
  { cat: "Payment", q: "Can I get a receipt for my payment?", a: "Yes. Official receipts are issued for all payments managed through the system, both digitally (PDF and Word) and in hard copy at the district office." },

  // ── Security ──────────────────────────────────────────────
  { cat: "Security", q: "Is my data secure on this platform?", a: "Yes. All data is encrypted with AES-256, access is controlled by role-based permissions, all actions are immutably logged in an audit trail, and multi-factor authentication (OTP via email and SMS) protects every account." },
  { cat: "Security", q: "What is the two-factor authentication (MFA)?", a: "After entering your email and password, the system sends a 6-digit verification code to your registered email address AND phone number via SMS. You must enter this code to complete your login. The code expires in 10 minutes." },
  { cat: "Security", q: "What happens if I forget my password?", a: "Use the 'Forgot Password' link on the login page to request a reset. A reset link is sent to your registered email and phone via SMS. You can also contact the District Assembly Administrator for assistance." },
  { cat: "Security", q: "What privacy controls protect public users?", a: "The public verification portal only displays public fields (Land ID, status, owner name, plot, block, sector, community, and registration date) and requires a verification code. Private land details, fees, additional lands, and officer information are never exposed to the public." },

  // ── Transfers ─────────────────────────────────────────────
  { cat: "Transfers", q: "How do I transfer land to another person?", a: "The current registered owner initiates a transfer request through the system, specifying the new owner's details and uploading a transfer letter. The transfer requires approval from the Physical Planning Officer or District Assembly Administrator. Once approved, a transfer certificate is issued and ownership history is updated." },
  { cat: "Transfers", q: "Who approves land transfers?", a: "Only the Physical Planning Officer and District Assembly Administrator are authorized to approve land transfers. The Land Registrar is responsible for updating the registry after approval." },

  // ── Technical ─────────────────────────────────────────────
  { cat: "Technical", q: "I can't log in to my account. What should I do?", a: "First, ensure you are using your correct @tenda.gov.gh email address. If you've forgotten your password, use the 'Forgot Password' link. If your account is locked, contact the District Assembly Administrator or submit a support ticket through this website." },
  { cat: "Technical", q: "How do I submit a support ticket?", a: "Log in to your staff account and navigate to 'Support Tickets' in the sidebar. Click 'New Ticket', fill in the subject, category, priority, and description, then submit. You will receive an email confirmation and be notified of all updates." },
  { cat: "Technical", q: "Does the system work without an internet connection?", a: "Yes. As a PWA, previously loaded data remains available offline and the system syncs automatically once connectivity is restored. Real-time updates resume immediately upon reconnection." },
];

const CATEGORIES = ["All", "General", "Features", "Registration", "Payment", "Security", "Transfers", "Technical"];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
        <span className="font-medium text-foreground">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-primary" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

export default function FAQPage() {
  const [cat, setCat] = useState("All");
  const [searchQ, setSearchQ] = useState("");

  const filtered = FAQS.filter((f) => {
    const matchCat = cat === "All" || f.cat === cat;
    const q = searchQ.toLowerCase();
    const matchQ = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <PublicNav />

      {/* Hero */}
      <section className="bg-primary pt-16">
        <div className="mx-auto max-w-[80rem] px-5 py-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">FAQ</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">Frequently Asked Questions</h1>
            <p className="mt-4 max-w-xl text-lg text-primary-foreground/80">
              Find answers to common questions about the platform's features, land registration, transfers, verification, payments, and security.
            </p>
            {/* Search */}
            <div className="relative mt-8 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search FAQ…" className="pl-10 h-12 bg-white text-foreground" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Body */}
      <section className="mx-auto max-w-[80rem] px-5 py-16">
        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition border",
                cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-muted-foreground">No FAQs match your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card px-6">
            {filtered.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-center">
          <p className="font-medium">Still have questions?</p>
          <p className="mt-1 text-sm text-muted-foreground">Contact the Techiman North District Assembly office or visit in person.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a href="mailto:info@tenda.gov.gh" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition">
              Email: info@tenda.gov.gh
            </a>
            <a href="tel:+233XXXXXXXX" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition">
              Call: +233 XX XXX XXXX
            </a>
          </div>
        </div>
      </section>

      <StickyFooter />
    </div>
  );
}
