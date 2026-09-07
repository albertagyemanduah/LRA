import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPinned, CheckCircle2, Building2, Users, Globe, Award, Target, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";

const SURVEY = "https://images.hostinger.com/1cf01faf-bfa6-4262-bcfa-179cc06f71ff.png";
const CITIZEN = "https://images.hostinger.com/a7dbec65-2e55-4a59-a87e-e8f967f65d44.png";

const TEAM_ROLES = [
  { role: "District Assembly Administrator", duty: "Oversees all land administration operations and system management." },
  { role: "Physical Planning Officer", duty: "Reviews applications, enforces planning compliance across all area councils." },
  { role: "Land Registrar", duty: "Registers titles, issues certificates and verifies supporting documents." },
  { role: "Survey Officer", duty: "Conducts cadastral surveys, captures GPS data and maintains boundary records." },
  { role: "Finance Officer", duty: "Manages invoices, reconciles payments and produces revenue reports." },
  { role: "Customary Land Secretariat", duty: "Maintains customary land records and manages dispute resolution." },
];

const VALUES = [
  { icon: Target, title: "Transparency", body: "Every land transaction is recorded with a complete audit trail accessible to authorized officers." },
  { icon: Eye, title: "Accountability", body: "Role-based access ensures every officer is responsible for actions within their mandate." },
  { icon: Award, title: "Compliance", body: "All operations comply with the Land Registration Act 2020 (Act 1036) and Ghana Land Policy 2024." },
  { icon: Globe, title: "Accessibility", body: "Digital-first platform accessible from all district offices and remote locations." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-12">
      <PublicNav />

      {/* Hero */}
      <section className="relative flex items-center overflow-hidden pt-16 min-h-[45vh]">
        <div className="absolute inset-0">
          <img src={SURVEY} alt="Land administration" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 to-primary/60" />
        </div>
        <div className="relative mx-auto max-w-[80rem] px-5 py-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">About Us</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">
              About the Techiman North<br />Land Registry System
            </h1>
            <p className="mt-4 max-w-xl text-lg text-primary-foreground/80">
              Ghana's premier digital land administration platform for the Techiman North District Assembly.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="mx-auto max-w-[80rem] px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Our Purpose</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Mission & Vision</h2>
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-lg font-semibold text-primary mb-2">Our Mission</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To provide secure, transparent, and efficient digital land administration services to the people and communities of the Techiman North District, ensuring every land transaction is properly recorded, verified, and certified in accordance with Ghanaian law.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-lg font-semibold text-primary mb-2">Our Vision</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To be the model district for digital land governance in Ghana — a system where every parcel of land is properly registered, ownership is clear and protected, and disputes are minimized through transparent record-keeping.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <img src={CITIZEN} alt="Land officer working" className="w-full rounded-3xl object-cover shadow-lg" />
            <div className="absolute -bottom-4 -right-4 hidden rounded-2xl border border-border bg-card p-5 shadow-xl sm:block">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <p className="font-display text-base font-bold">Act 1036 Compliant</p>
                  <p className="text-xs text-muted-foreground">Ghana Land Act 2020</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About the District */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-[80rem] px-5 py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">District Profile</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">About Techiman North District</h2>
          </div>
          <div className="prose prose-sm max-w-3xl mx-auto text-muted-foreground space-y-4">
            <p>The Techiman North District is one of the districts in the Bono East Region of Ghana. The district was carved out of the Techiman Municipality and has its administrative capital at Tuobodom. It is served by three district offices: Tuobodom, Offuman, and Akrofrom.</p>
            <p>The district comprises five Area Councils: <strong>Tuobodom</strong>, <strong>Offuman</strong>, <strong>Aworowa</strong>, <strong>Buoyem</strong>, and <strong>Krobo</strong>. These area councils cover diverse communities with varying land use patterns including agriculture, settlement, and commercial activities.</p>
            <p>Land administration in the district is governed by the Techiman North District Assembly, which oversees all matters related to land registration, survey, and certification in accordance with the Land Registration Act 2020 (Act 1036) and the Ghana Land Policy 2024.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3 mt-10 max-w-2xl mx-auto">
            {[
              { value: "5", label: "Area Councils", icon: MapPinned },
              { value: "3", label: "District Offices", icon: Building2 },
              { value: "6", label: "Staff Roles", icon: Users },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
                  <s.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="font-display text-3xl font-extrabold text-primary mt-3">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="mx-auto max-w-[80rem] px-5 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">What We Stand For</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Our Core Values</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <v.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Team Roles */}
      <section className="border-t border-border bg-primary">
        <div className="mx-auto max-w-[80rem] px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Our Team</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-white tracking-tight">Organizational Structure</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_ROLES.map((t) => (
              <div key={t.role} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-display text-sm font-semibold text-white">{t.role}</p>
                <p className="mt-1.5 text-sm text-primary-foreground/70 leading-relaxed">{t.duty}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StickyFooter />
    </div>
  );
}
