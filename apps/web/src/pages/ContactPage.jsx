import React, { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import OtherSelect from "@/components/OtherSelect";
import { useToast } from "@/hooks/use-toast";
import DuplicateCheck from "@/components/DuplicateCheck";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";

const OFFICES = [
  { name: "Tuobodom Office (Main)", address: "District Assembly Headquarters, Tuobodom", phone: "+233 XX XXX XXXX", email: "tuobodom@tenda.gov.gh", hours: "Mon–Fri 8:00am–5:00pm", areaCouncils: ["Tuobodom"] },
  { name: "Offuman Office", address: "Offuman Community Centre, Offuman", phone: "+233 XX XXX XXXX", email: "offuman@tenda.gov.gh", hours: "Mon–Fri 8:00am–5:00pm", areaCouncils: ["Offuman"] },
  { name: "Akrofrom Office", address: "Akrofrom District Office, Akrofrom", phone: "+233 XX XXX XXXX", email: "akrofrom@tenda.gov.gh", hours: "Mon–Fri 8:00am–5:00pm", areaCouncils: ["Aworowa", "Buoyem", "Krobo"] },
];

const SUBJECTS = ["Land Registration Inquiry", "Title Search", "Document Issue", "Payment Issue", "Technical Support", "General Inquiry", "Complaint", "Other"];

export default function ContactPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "General Inquiry", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.message) {
      toast({ variant: "destructive", title: "Please fill in all required fields" }); return;
    }
    setLoading(true);
    // Simulate submission (in production, this would call an API or PB)
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
    toast({ title: "Message sent!", description: "We'll get back to you within 2 business days." });
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <PublicNav />

      {/* Hero */}
      <section className="bg-primary pt-16">
        <div className="mx-auto max-w-[80rem] px-5 py-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Get In Touch</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">Contact Us</h1>
            <p className="mt-4 max-w-xl text-lg text-primary-foreground/80">
              Reach out to any of our district offices for assistance with land registration, queries, or complaints.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Office Locations */}
      <section className="mx-auto max-w-[80rem] px-5 py-16">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Our Offices</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">District Office Locations</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {OFFICES.map((o, i) => (
            <motion.div key={o.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="font-display text-sm font-semibold">{o.name}</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>{o.address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span>{o.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span>{o.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span>{o.hours}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">Area Councils Served:</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {o.areaCouncils.map((ac) => (
                    <span key={ac} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{ac}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact Form */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-[80rem] px-5 py-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">Send a Message</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">We'd love to hear from you</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Fill in the form and our team will get back to you within 2 business days. For urgent matters, please call or visit your nearest district office.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">info@tenda.gov.gh</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Phone className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Main Office</p>
                    <p className="text-sm text-muted-foreground">+233 XX XXX XXXX</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Office Hours</p>
                    <p className="text-sm text-muted-foreground">Monday–Friday, 8:00am – 5:00pm</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              {submitted ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 mb-4">
                    <CheckCircle2 className="h-8 w-8" />
                  </span>
                  <h3 className="font-display text-xl font-bold">Message Sent!</h3>
                  <p className="mt-2 text-muted-foreground">We'll get back to you within 2 business days.</p>
                  <Button className="mt-6" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "General Inquiry", message: "" }); }}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <OtherSelect options={SUBJECTS} value={form.subject} onChange={(v) => setForm((f) => ({ ...f, subject: v }))} placeholder="Select subject" inputLabel="Specify subject" inputPlaceholder="Enter subject" allowEmpty={false} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Message *</Label>
                    <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Describe your inquiry or issue in detail…" rows={5} />
                  </div>
                  <DuplicateCheck type="contact" label="Check for duplicate record"
                    getData={() => ({ name: form.name, phone: form.phone })} />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : <><Send className="mr-1.5 h-4 w-4" /> Send Message</>}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <StickyFooter />
    </div>
  );
}
