import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import {
  BookOpen, Search, ChevronRight, ChevronDown, Download, Printer,
  HelpCircle, Star, AlertCircle, CheckCircle2, Info, ArrowRight,
  User, MapPin, FileText, CreditCard, Upload, MessageCircle,
  BarChart3, Settings, Shield, RefreshCw, Globe, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Star,
    color: "text-blue-700",
    bg: "bg-blue-50",
    subsections: [
      {
        id: "login",
        title: "Login & Authentication",
        content: [
          { type: "intro", text: "The Techiman North District Assembly (TeNDA) Land Registry System requires authenticated access. All staff accounts are created by an Administrator." },
          { type: "steps", title: "How to Log In", steps: [
            "Navigate to the application URL or open the installed PWA.",
            "Enter your official @tenda.gov.gh email address.",
            "Enter your password (minimum 8 characters).",
            "If MFA is enabled, enter the OTP code sent to your registered phone or email.",
            "Click 'Sign In' to access your dashboard.",
          ]},
          { type: "note", text: "If you cannot log in, contact your system administrator to verify your account credentials or reset your password." },
          { type: "tip", text: "Your session will automatically expire after 20 minutes of inactivity to protect sensitive land data." },
        ],
      },
      {
        id: "dashboard-overview",
        title: "Dashboard Overview",
        content: [
          { type: "intro", text: "After logging in, you'll see your role-specific dashboard showing key metrics, recent activity, and quick-access modules." },
          { type: "steps", title: "Dashboard Elements", steps: [
            "Top navigation bar with search, notifications, and user profile.",
            "Left sidebar with module navigation links.",
            "Overview statistics cards showing totals at a glance.",
            "Recent activity feed showing the latest operations.",
            "Quick action buttons for common tasks.",
          ]},
          { type: "note", text: "Each role sees a tailored dashboard. Admins see all modules; other roles see only their permitted modules." },
        ],
      },
      {
        id: "navigation",
        title: "Navigation Guide",
        content: [
          { type: "intro", text: "Use the left sidebar to navigate between modules. The active module is highlighted." },
          { type: "list", title: "Available Modules by Role", items: [
            "Land Registration — Register and manage land parcels",
            "Applications — Review and process land applications",
            "Surveys — Schedule and record cadastral surveys",
            "Documents — Upload and manage land documents",
            "Payments — Process invoices and record payments",
            "Reports & Analytics — View statistics and generate reports",
            "Messages — Direct staff communication",
            "Support Tickets — Create and track support requests",
            "Admin Panel — User management (Admin only)",
            "Template Designer — Customize certificates (Admin only)",
          ]},
        ],
      },
      {
        id: "profile-setup",
        title: "Profile Setup",
        content: [
          { type: "intro", text: "Complete your profile to ensure proper identification in all system activities." },
          { type: "steps", title: "Setting Up Your Profile", steps: [
            "Click your name/avatar in the top-right corner.",
            "Select 'Profile' from the dropdown menu.",
            "Upload a profile photo (JPG, PNG, GIF, WebP — max 5MB).",
            "Verify your personal information (name, Ghana Card, phone, WhatsApp).",
            "Update any outdated contact information.",
            "Click 'Save Changes' to update your profile.",
          ]},
          { type: "tip", text: "Keep your WhatsApp number up to date — it is used for automated SMS notifications about land registrations." },
        ],
      },
    ],
  },
  {
    id: "application-features",
    title: "Application Features",
    icon: Star,
    color: "text-blue-700",
    bg: "bg-blue-50",
    subsections: [
      {
        id: "features-overview",
        title: "Major Features Overview",
        content: [
          { type: "intro", text: "The TeNDA Land Registry System is a complete digital land administration platform. This section summarizes the major features available across the platform and points you to the relevant workflow sections." },
          { type: "list", title: "Core Capabilities", items: [
            "Land Registration — Capture parcel and owner details with automatic Land ID assignment.",
            "Separate Multiple-Land Records — Each land for an owner becomes its own parcel with its own Land ID.",
            "Administrative Hierarchy — Office → Area Council → Community → Sector cascading structure.",
            "Parcel ID Format & Correction — Automatic TeNDA-PPD-[ABBR]-XXXX IDs with an admin correction tool.",
            "Land Transfers — Formal ownership change with approval workflow and certificates.",
            "Amendments — Requested or direct edits with approval and notifications.",
            "Approvals Workspace — Centralized review of edit, delete, and transfer requests.",
            "Public Land Verification — Code-protected public lookup of registered lands.",
            "Payments & Invoices — Fee recording, receipts (PDF/Word), and financial reports.",
            "Reports & Analytics — Statistics, trends, AI insights, and exports.",
            "Bulk Import & Export — CSV/XLS/XLSX import and CSV/XLS/XLSX/PDF/SQL export.",
            "Notifications & SMS — Real-time in-app alerts and SMS to contact numbers.",
            "Ownership History — Immutable chain of custody for every parcel.",
            "Role-Based Access Control — Module and data scoping by role and jurisdiction.",
            "Audit Trails — Immutable logging of every system action.",
            "Chat & Support Tickets — Direct staff messaging and formal issue tracking.",
            "Offline & Real-Time — PWA offline access with live synchronization.",
          ]},
          { type: "tip", text: "Use the table of contents on the left to jump to detailed guidance for each feature." },
        ],
      },
      {
        id: "features-multiple-lands",
        title: "Separate Multiple-Land Records",
        content: [
          { type: "intro", text: "When an owner has more than one land, the system creates a separate parcel record for each land rather than grouping them under a single record." },
          { type: "steps", title: "How It Works", steps: [
            "Open the registration form and complete the main land details (owner + first land).",
            "Use the Additional Lands editor to add extra lands, each with Area Council, Community, Sector, Plot Number, and Block.",
            "On submit, the system creates one parcel per land — the main land plus each additional land.",
            "Each parcel receives its own TeNDA-PPD-[ABBR]-XXXX Land ID, status, and audit trail.",
            "The owner is registered once; their identity is shared across all their parcels.",
            "A confirmation SMS is sent per registered land to all contact numbers (except WhatsApp).",
          ]},
          { type: "note", text: "Each land can be searched, transferred, amended, exported, and verified independently. Duplicate Sector + Plot + Block combinations are rejected during registration." },
        ],
      },
      {
        id: "features-hierarchy",
        title: "Administrative Hierarchy",
        content: [
          { type: "intro", text: "Every parcel is linked to the district's administrative structure: Office → Area Council → Community → Sector." },
          { type: "list", title: "What the Hierarchy Drives", items: [
            "Cascading dropdowns during registration and amendments (selecting an Area Council filters Communities, which filters Sectors).",
            "Role-based scoping — officers see only lands within their assigned office, area council, community, or sector.",
            "Filters and reports grouped by community, area council, and office.",
            "Public verification searches scoped by Area Council, Community, and Sector.",
          ]},
          { type: "tip", text: "If a community or sector is not listed, choose 'Other' to enter a custom value — the textbox appears immediately." },
        ],
      },
      {
        id: "features-parcel-id",
        title: "Parcel ID Format & Correction",
        content: [
          { type: "intro", text: "Land IDs follow the canonical format TeNDA-PPD-[COMMUNITY ABBREVIATION]-XXXX, for example TeNDA-PPD-ADUM-0001. The abbreviation is the first four letters of the community name, uppercased." },
          { type: "steps", title: "Correcting Parcel IDs (Admin only)", steps: [
            "Open 'Parcel ID Correction' from the sidebar (District Assembly Administrators only).",
            "Click 'Scan for ID errors' to detect malformed, duplicate, or community-mismatched IDs.",
            "Review the preview table showing current ID, proposed ID, community, and reason.",
            "Select specific rows and click 'Correct selected (N)', or click 'Correct all' to fix every error.",
            "Confirm the permanent change in the Yes/No dialog.",
            "Monitor the real-time progress bar; cancel safely at any time — completed corrections are preserved.",
            "Use 'Retry failed' to re-attempt any rows that failed.",
          ]},
          { type: "warning", text: "Changing Land IDs is permanent and logged in the audit trail. Related payment records are synced automatically. Only Administrators can change parcel IDs." },
        ],
      },
      {
        id: "features-approvals",
        title: "Approvals Workspace",
        content: [
          { type: "intro", text: "The Approvals module is a single, centralized queue for reviewing land edit, delete, and transfer requests." },
          { type: "list", title: "What You Can Do", items: [
            "Approve, reject, or request more information on pending requests.",
            "Edit pending transfer details (new owner name, phone, reason, certificate number).",
            "Filter by type (edit, delete, transfer) and status (pending, approved, rejected).",
            "Search by parcel, applicant, or type.",
            "Permanently delete rejected approvals (Admin only), singly or in bulk.",
          ]},
          { type: "tip", text: "A red blinking banner on the dashboard alerts approvers when pending requests are waiting. Click it to open the queue." },
        ],
      },
      {
        id: "features-verification",
        title: "Public Land Verification",
        content: [
          { type: "intro", text: "The public verification portal lets community members confirm land registration status using a secure verification code." },
          { type: "steps", title: "Public Verification Flow", steps: [
            "Open the 'Verify Land' page from the public website.",
            "Enter the 10-character verification code issued by the District Assembly.",
            "After validation, search by Area Council, Community, Sector, Plot Number, or Block.",
            "Review the public result: Land ID, status, owner name, plot, block, sector, community, and registration date.",
          ]},
          { type: "note", text: "Only public fields are shown. Private details, fees, additional lands, and officer information are never exposed. Admins generate verification codes from the Verification Codes module." },
        ],
      },
      {
        id: "features-notifications",
        title: "Notifications & SMS",
        content: [
          { type: "intro", text: "The system keeps staff and owners informed through real-time in-app notifications and SMS alerts." },
          { type: "list", title: "Notification Triggers", items: [
            "Land registration confirmation (SMS to all contact numbers except WhatsApp).",
            "Transfer, amendment, and approval status updates.",
            "Rejection and information-request alerts.",
            "Reminders based on your notification preferences.",
          ]},
          { type: "tip", text: "Customize your channels, frequency, and quiet hours from 'Notification Preferences' in the sidebar." },
        ],
      },
      {
        id: "features-audit-offline",
        title: "Audit Trails, Roles & Offline",
        content: [
          { type: "intro", text: "Security, accountability, and resilience are built into the platform." },
          { type: "list", title: "Key Behaviours", items: [
            "Audit Trail — Every registration, transfer, amendment, approval, deletion, status change, and parcel ID correction is immutably logged with actor and timestamp.",
            "Role-Based Access — Modules and records are gated by role; officers are scoped to their assigned jurisdiction. Multi-role users can switch roles from the header.",
            "Offline Access — As a PWA, previously loaded data stays available without a connection and syncs automatically when back online.",
            "Real-Time Sync — Live subscriptions push changes to all connected users immediately.",
          ]},
          { type: "note", text: "Admins can review and export the full audit trail from the Admin Panel." },
        ],
      },
    ],
  },
  {
    id: "land-registration",
    title: "Land Registration",
    icon: MapPin,
    color: "text-blue-600",
    bg: "bg-blue-50",
    subsections: [
      {
        id: "register-land",
        title: "How to Register Land",
        content: [
          { type: "intro", text: "Land registration captures the legal details of a land parcel and assigns it a unique Land ID in the district registry." },
          { type: "steps", title: "Registration Process", steps: [
            "Navigate to 'Land Registration' in the sidebar.",
            "Click the 'Register Parcel' button (top-right).",
            "Fill in the Personal Information section: Applicant Name, Mobile, Alternate Mobile, WhatsApp, Email, Religion, Tribe.",
            "Fill in the Location Details: Area Council, Community, Sector, Plot Number, Block.",
            "Enter the Registration Dates: Allocation Date and Registration Date.",
            "Optionally add Payment Information: amount, method, status, reference.",
            "Click 'Register Parcel' to submit for review.",
          ]},
          { type: "warning", text: "Allocation Date must be on or before the Registration Date. Duplicate Plot/Block/Area Council combinations are automatically rejected." },
          { type: "note", text: "After submission, the parcel status is 'Submitted' and awaits approval from a Physical Planning Officer or Administrator." },
        ],
      },
      {
        id: "form-fields",
        title: "Form Fields Explanation",
        content: [
          { type: "intro", text: "Each field in the registration form serves a specific purpose in the land record." },
          { type: "list", title: "Personal Information Fields", items: [
            "Applicant Name — Full legal name of the land owner as on Ghana Card",
            "Mobile — Primary contact number (9–15 digits, Ghana format)",
            "Alternate Mobile — Secondary contact number for important communications",
            "WhatsApp — WhatsApp number for instant notifications",
            "Email — Email address for digital communication",
            "Religion — Religious affiliation (for customary law compliance)",
            "Tribe — Ethnic group (relevant for customary land rights)",
          ]},
          { type: "list", title: "Location Fields", items: [
            "Area Council — Administrative subdivision of the district",
            "Community — Village or town name within the area council",
            "Sector — Numbered or named planning sector within the community",
            "Plot Number — Unique plot identifier within the sector",
            "Block — Block designation within the plot layout",
            "Allocation Date — Date the land was originally allocated",
            "Registration Date — Date of formal registration",
          ]},
        ],
      },
      {
        id: "approval-workflow",
        title: "Approval Workflow",
        content: [
          { type: "intro", text: "All land registrations go through a multi-step approval process to ensure accuracy and legality." },
          { type: "steps", title: "Approval Steps", steps: [
            "Applicant submits registration — Status: 'Submitted'.",
            "Physical Planning Officer reviews the application.",
            "Survey Officer may schedule a field survey — Status: 'Under Survey'.",
            "Land Registrar verifies documents — Status: 'Under Review'.",
            "Physical Planning Officer or Admin approves — Status: 'Registered'.",
            "Certificate is generated and issued.",
          ]},
          { type: "tip", text: "You will receive SMS and in-app notifications at each stage of the approval process." },
        ],
      },
      {
        id: "status-tracking",
        title: "Status Tracking",
        content: [
          { type: "intro", text: "Each parcel has a status that indicates its current position in the registration process." },
          { type: "list", title: "Status Definitions", items: [
            "Draft — Saved but not submitted",
            "Submitted — Submitted for review, awaiting action",
            "Under Survey — Field survey scheduled or in progress",
            "Under Review — Documents being verified by Registrar",
            "Registered — Fully registered, certificate available",
            "Disputed — Ownership or boundary dispute filed",
            "Rejected — Application rejected, reason provided",
          ]},
          { type: "note", text: "Deleted records are color-graded RED; transferred records show a yellow TRANSFERRED badge." },
        ],
      },
    ],
  },
  {
    id: "land-transfer",
    title: "Land Transfer",
    icon: ArrowRight,
    color: "text-purple-600",
    bg: "bg-purple-50",
    subsections: [
      {
        id: "how-to-transfer",
        title: "How to Transfer Land",
        content: [
          { type: "intro", text: "Land transfer changes the registered ownership of a parcel from one person to another through a formal approval process." },
          { type: "steps", title: "Transfer Process", steps: [
            "Navigate to 'Land Registration' and find the parcel to transfer.",
            "Click the 'Transfer' button on the parcel card.",
            "Enter the new owner's details: Name, Phone, and reason for transfer.",
            "Submit the transfer request for approval.",
            "Physical Planning Officer or Administrator reviews and approves/rejects.",
            "On approval, a transfer certificate is generated and both parties are notified by SMS.",
          ]},
          { type: "warning", text: "Only parcels with 'Registered' status can be transferred. Disputed parcels must be resolved first." },
        ],
      },
      {
        id: "ownership-history",
        title: "Ownership History",
        content: [
          { type: "intro", text: "The system maintains a complete chain of custody for every land parcel." },
          { type: "steps", title: "Viewing Ownership History", steps: [
            "Find the parcel in the Land Registration module.",
            "Click the 'History' button on the parcel card.",
            "Review all previous owners with dates and transfer reasons.",
            "Export the history as a PDF if needed for legal purposes.",
          ]},
          { type: "note", text: "Ownership history is immutable — once recorded, it cannot be altered, ensuring a permanent legal audit trail." },
        ],
      },
    ],
  },
  {
    id: "bulk-operations",
    title: "Bulk Operations",
    icon: Upload,
    color: "text-orange-600",
    bg: "bg-orange-50",
    subsections: [
      {
        id: "bulk-import",
        title: "Bulk Import Process",
        content: [
          { type: "intro", text: "Administrators can import multiple land records at once using a CSV file." },
          { type: "steps", title: "Bulk Import Steps", steps: [
            "Navigate to 'Land Registration' and click 'Import' (Admin only).",
            "Click 'Template' to download the CSV template.",
            "Fill in the template with land records (applicantName is the only required field).",
            "Click 'Choose file' and select your completed CSV.",
            "Review the parsed preview (first 3 rows shown).",
            "Click 'Auto-Register N Records' to import.",
            "Monitor the real-time progress bar (percentage, speed, ETA).",
            "Download the import report after completion.",
          ]},
          { type: "tip", text: "Plot format: Enter '123/A' — the system auto-splits into Plot Number '123' and Block 'A'. Phone format: '0244123456/0554987654' splits into Mobile and Alternate Mobile." },
          { type: "list", title: "Supported Date Formats", items: [
            "YYYY-MM-DD (e.g., 2024-03-15) — ISO standard, preferred",
            "DD/MM/YYYY (e.g., 15/03/2024) — Ghana standard",
            "MM/DD/YYYY (e.g., 03/15/2024) — US format (auto-detected)",
            "DD-MM-YYYY (e.g., 15-03-2024) — Hyphen-separated",
          ]},
        ],
      },
      {
        id: "bulk-actions",
        title: "Bulk Actions on Records",
        content: [
          { type: "intro", text: "Select multiple parcels to perform batch operations efficiently." },
          { type: "steps", title: "Performing Bulk Actions", steps: [
            "Use the checkboxes on parcel cards to select records.",
            "Click 'Select all' to select all filtered records.",
            "Choose an action from the Bulk Operations toolbar.",
            "Monitor the progress bar for real-time updates.",
            "Review the completion report after the operation.",
          ]},
          { type: "list", title: "Available Bulk Actions", items: [
            "Bulk Register — Change selected parcels to 'Registered' status",
            "Bulk Dispute — Flag selected parcels as disputed",
            "Bulk Amend Request — Submit amendment requests for multiple parcels",
            "Set Status — Change status of all selected parcels at once",
            "Bulk Delete — Soft-delete selected parcels (with reason)",
          ]},
          { type: "warning", text: "Bulk operations are logged in the audit trail. All actions require confirmation and some require a reason." },
        ],
      },
    ],
  },
  {
    id: "certificates",
    title: "Certificates",
    icon: FileText,
    color: "text-teal-600",
    bg: "bg-teal-50",
    subsections: [
      {
        id: "generate-cert",
        title: "How to Generate Certificates",
        content: [
          { type: "intro", text: "Land title certificates can be generated for any registered parcel." },
          { type: "steps", title: "Certificate Generation", steps: [
            "Navigate to 'Land Registration' and find the registered parcel.",
            "Click the certificate icon or 'Certificate' button.",
            "The system loads the default certificate template.",
            "Review the pre-filled land and owner details.",
            "Click 'Download PDF' to save the certificate.",
            "Certificate is also stored in the parcel's document history.",
          ]},
          { type: "tip", text: "Certificates can be customized using the Template Designer (Admin only) to include custom backgrounds, logos, and field arrangements." },
        ],
      },
      {
        id: "cert-templates",
        title: "Certificate Templates",
        content: [
          { type: "intro", text: "Administrators can create and manage multiple certificate templates in the Admin Panel." },
          { type: "steps", title: "Managing Templates", steps: [
            "Go to Admin Panel → Certificates tab.",
            "Click 'New Template' to create a template.",
            "Enter template name, header text, and footer/legal text.",
            "Upload a background image (optional, JPEG/PNG).",
            "Select which fields to include on the certificate.",
            "Click 'Save Template'.",
            "Set the template as 'Default' to use for all certificate generation.",
          ]},
        ],
      },
    ],
  },
  {
    id: "invoices-payments",
    title: "Invoices & Payments",
    icon: CreditCard,
    color: "text-blue-700",
    bg: "bg-blue-50",
    subsections: [
      {
        id: "create-invoice",
        title: "Creating Invoices",
        content: [
          { type: "intro", text: "Finance Officers can create invoices linked to specific land records for various fees." },
          { type: "steps", title: "Invoice Creation", steps: [
            "Navigate to 'Payments' in the sidebar.",
            "Click 'New Invoice' or 'Record Payment'.",
            "Search for and select the land record.",
            "Land details (owner, plot, area council) are auto-populated.",
            "Select the charge type (Registration Fee, Transfer Fee, etc.).",
            "Enter the amount and payment method.",
            "Set payment status (Pending, Paid, etc.).",
            "Click 'Save' to create the invoice/payment record.",
          ]},
          { type: "list", title: "Available Charge Types", items: [
            "Registration Fee — For new land registrations",
            "Search Fee — For land verification searches",
            "Survey Fee — For cadastral surveys",
            "Processing Fee — General administrative processing",
            "Ground Rent — Annual land rent payment",
            "Penalty — Late payment or violation fines",
          ]},
        ],
      },
      {
        id: "pdf-word-download",
        title: "Downloading Receipts (PDF & Word)",
        content: [
          { type: "intro", text: "Receipts can be downloaded in PDF or Microsoft Word format." },
          { type: "steps", title: "Download Steps", steps: [
            "Find the payment record in the Payments module.",
            "Click 'View' or the receipt icon to open the receipt modal.",
            "Click 'Download PDF' for a professional PDF receipt.",
            "Click 'Download Word' for an editable Word document.",
            "Both formats include all payment details, land information, and owner details.",
          ]},
          { type: "note", text: "PDF receipts are suitable for official submission. Word documents can be edited for customization." },
        ],
      },
    ],
  },
  {
    id: "reports-analytics",
    title: "Reports & Analytics",
    icon: BarChart3,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    subsections: [
      {
        id: "accessing-reports",
        title: "Accessing Reports",
        content: [
          { type: "intro", text: "The Reports & Analytics module provides comprehensive statistics on all aspects of the land registry." },
          { type: "steps", title: "Using the Reports Module", steps: [
            "Click 'Reports & Analytics' in the sidebar.",
            "Select a tab: Overview, Community, Area Council, Office, or Trends.",
            "Use date filters to narrow the analysis period.",
            "Hover over charts for detailed data points.",
            "Click 'Export CSV' or 'Export PDF' to download reports.",
            "Click the refresh icon to update statistics in real-time.",
          ]},
          { type: "list", title: "Report Categories", items: [
            "Overview — System-wide totals and summaries",
            "Community Statistics — Land data broken down by community",
            "Area Council Statistics — Data grouped by area council",
            "Office Statistics — Performance metrics by office",
            "Trends — Monthly/yearly registration, revenue, and workflow trends",
          ]},
        ],
      },
      {
        id: "exporting-data",
        title: "Exporting Data",
        content: [
          { type: "intro", text: "All reports and data can be exported for external analysis or official reporting." },
          { type: "list", title: "Export Options", items: [
            "Land Parcels CSV — All parcel data with current filters applied",
            "User List CSV — Staff directory (Admin only)",
            "Audit Trail CSV — Complete system activity log",
            "Payment Records — Payment and invoice history",
            "Report PDF — Statistical report with charts",
          ]},
          { type: "tip", text: "Apply filters before exporting to get focused datasets. Date range filters help create period-specific reports." },
        ],
      },
    ],
  },
  {
    id: "chat-tickets",
    title: "Chat & Support Tickets",
    icon: MessageCircle,
    color: "text-pink-600",
    bg: "bg-pink-50",
    subsections: [
      {
        id: "using-chat",
        title: "Using the Chat System",
        content: [
          { type: "intro", text: "The built-in chat allows direct messaging between staff members." },
          { type: "steps", title: "Sending Messages", steps: [
            "Click 'Messages' in the sidebar.",
            "Use the search bar to find a colleague by name or email.",
            "Click on a contact to open the conversation.",
            "Type your message in the input box.",
            "Press Enter or click Send to deliver the message.",
            "Messages are delivered in real-time and marked as read when viewed.",
          ]},
          { type: "note", text: "Chat history is retained for audit purposes. Do not share sensitive passwords via chat." },
        ],
      },
      {
        id: "support-tickets",
        title: "Support Tickets",
        content: [
          { type: "intro", text: "Use support tickets for formal issue reporting, feature requests, and data corrections." },
          { type: "steps", title: "Creating a Ticket", steps: [
            "Click 'Support Tickets' in the sidebar.",
            "Click 'New Ticket' or the + button.",
            "Select Category (Bug Report, Feature Request, Data Issue, etc.).",
            "Set Priority (Low, Medium, High, Urgent).",
            "Enter a clear Subject line.",
            "Describe the issue in Detail (include steps to reproduce).",
            "Optionally attach files (screenshots, documents).",
            "Optionally link to a related Land ID.",
            "Click 'Submit Ticket'.",
          ]},
          { type: "list", title: "Ticket Status Flow", items: [
            "Open — Ticket submitted, awaiting assignment",
            "In Progress — Assigned and being worked on",
            "Resolved — Solution applied, awaiting confirmation",
            "Closed — Confirmed resolved and closed",
          ]},
        ],
      },
    ],
  },
  {
    id: "admin-features",
    title: "Admin Features",
    icon: Settings,
    color: "text-red-600",
    bg: "bg-red-50",
    subsections: [
      {
        id: "user-management",
        title: "User Management",
        content: [
          { type: "intro", text: "Administrators manage all staff accounts, roles, and access permissions." },
          { type: "steps", title: "Creating a Staff Account", steps: [
            "Go to Admin Panel → Users tab.",
            "Click 'Add Staff'.",
            "Enter First Name, Middle Name (optional), Surname.",
            "Enter Ghana Card Number, Phone, WhatsApp.",
            "Assign an Office (Tuobodom, Offuman, or Akrofrom).",
            "Enter email (@tenda.gov.gh domain required).",
            "Select one or more roles.",
            "Choose to auto-generate password (sent via SMS) or set manually.",
            "Click 'Create Staff Account'.",
          ]},
          { type: "list", title: "Available Roles", items: [
            "Physical Planning Officer — Land review and approval",
            "Survey Officer — Cadastral surveys and measurements",
            "Land Registrar — Title registration and document verification",
            "Finance Officer — Invoice and payment management",
            "District Assembly Administrator — Full system oversight",
            "Customary Land Secretariat — Customary land records",
          ]},
          { type: "warning", text: "Deleting a user is permanent and removes their account. All their records remain linked but unowned. Use this only for leavers." },
        ],
      },
      {
        id: "customization",
        title: "System Customization",
        content: [
          { type: "intro", text: "Administrators can customize the application's branding, colors, and content." },
          { type: "steps", title: "Customization Options", steps: [
            "Go to Admin Panel → Customise tab.",
            "Update Application Name, Tagline, Logo, and Favicon.",
            "Set Primary and Accent colors using HSL format.",
            "Update Contact Information (phone, email, address).",
            "Edit Footer, About, Terms & Conditions, and Privacy Policy text.",
            "Add Social Media links.",
            "Click 'Save & Apply' to apply changes immediately.",
          ]},
          { type: "tip", text: "Color format is HSL: hue saturation% lightness% (e.g., 158 64% 20% for the default green). Use a color picker to get HSL values." },
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQ",
    icon: HelpCircle,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    subsections: [
      {
        id: "common-errors",
        title: "Common Errors & Solutions",
        content: [
          { type: "intro", text: "Solutions to the most frequently encountered issues in the system." },
          { type: "list", title: "Login Issues", items: [
            "Incorrect password → Use 'Forgot Password' to request an OTP reset via SMS",
            "Account locked → Contact your Administrator to unlock",
            "Session expired → This is normal after 20 minutes of inactivity; log in again",
            "Email not recognized → Ensure you're using your @tenda.gov.gh address",
          ]},
          { type: "list", title: "Registration Issues", items: [
            "Duplicate parcel error → The Plot/Block/Area Council combination already exists; check existing records",
            "Invalid email format → Use a proper email like name@example.com",
            "Invalid phone number → Use 9–15 digits, optionally with +233 country code",
            "Date validation error → Allocation date cannot be later than Registration date",
          ]},
          { type: "list", title: "File/Import Issues", items: [
            "CSV not parsed → Ensure the file uses UTF-8 encoding and comma separators",
            "Import fails → Check that applicantName column exists and has values",
            "Dates not recognized → Use YYYY-MM-DD format for guaranteed parsing",
            "File too large → Maximum upload size is 15 MB per file",
          ]},
        ],
      },
      {
        id: "faq",
        title: "Frequently Asked Questions",
        content: [
          { type: "intro", text: "Answers to common questions about the TeNDA Land Registry System." },
          { type: "list", title: "General Questions", items: [
            "Q: Who can create user accounts? A: Only Administrators (District Assembly Administrator role).",
            "Q: Can a staff member have multiple roles? A: Yes, admins can assign multiple roles to one account.",
            "Q: How do I reset my password? A: Use the OTP reset on the login page — a code will be sent to your phone.",
            "Q: Is my data backed up? A: Yes, the database is automatically backed up daily.",
            "Q: Can I access the system on mobile? A: Yes, install it as a PWA from your browser for a full mobile experience.",
            "Q: What browsers are supported? A: Chrome, Firefox, Edge, and Safari (latest versions).",
          ]},
          { type: "list", title: "Land Registration Questions", items: [
            "Q: Can I register land without a Ghana Card? A: Ghana Card is strongly recommended but not technically required.",
            "Q: How long does approval take? A: Typically 3–5 business days depending on survey requirements.",
            "Q: Can I edit a registered parcel? A: Staff can request an edit; Planning Officers and Admins can edit directly.",
            "Q: What is a soft delete? A: The record is hidden from active view but preserved in the system for audit purposes.",
            "Q: Can deleted records be restored? A: Yes, Admins and Planning Officers can restore soft-deleted records.",
          ]},
        ],
      },
      {
        id: "glossary",
        title: "Glossary of Terms",
        content: [
          { type: "intro", text: "Definitions of technical and legal terms used in the system." },
          { type: "list", title: "Technical Terms", items: [
            "Parcel — A defined unit of land with a unique Land ID",
            "Land ID — Unique identifier for each land parcel (format: LAND-YYYYNNNN)",
            "Soft Delete — Marking a record as deleted while preserving it in the database",
            "Audit Trail — Immutable log of all system actions with timestamps and user details",
            "OTP — One-Time Password; a temporary code for authentication",
            "PWA — Progressive Web App; installable web application with offline capability",
            "MFA — Multi-Factor Authentication; additional login verification step",
          ]},
          { type: "list", title: "Legal/Land Terms", items: [
            "Allocation Date — Date the land was originally allocated to the owner",
            "Registration Date — Date of formal legal registration",
            "Area Council — Administrative sub-district of the Techiman North District",
            "Sector — Planning sub-division within a community",
            "Plot Number — Unique number identifying the land plot within a sector",
            "Block — Block designation for grouped plots in a layout",
            "Transfer Certificate — Official document confirming change of land ownership",
            "Title Certificate — Official document proving registered ownership of land",
          ]},
        ],
      },
    ],
  },
];

function NoteBlock({ type, text }) {
  const cfg = {
    note: { icon: Info, bg: "bg-blue-50 border-blue-200", text: "text-blue-800", icon_color: "text-blue-500" },
    tip: { icon: Star, bg: "bg-blue-50 border-blue-200", text: "text-blue-900", icon_color: "text-blue-500" },
    warning: { icon: AlertCircle, bg: "bg-blue-50 border-blue-200", text: "text-blue-800", icon_color: "text-blue-500" },
  }[type] || { icon: Info, bg: "bg-gray-50 border-gray-200", text: "text-gray-800", icon_color: "text-gray-500" };
  const Icon = cfg.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3 text-sm", cfg.bg)}>
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.icon_color)} />
      <span className={cfg.text}>{text}</span>
    </div>
  );
}

function ContentBlock({ block }) {
  if (block.type === "intro") return <p className="text-sm text-muted-foreground leading-relaxed">{block.text}</p>;
  if (block.type === "note" || block.type === "tip" || block.type === "warning") return <NoteBlock type={block.type} text={block.text} />;
  if (block.type === "steps") return (
    <div>
      {block.title && <p className="text-sm font-semibold mb-2">{block.title}</p>}
      <ol className="space-y-1.5">
        {block.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
            <span className="text-muted-foreground leading-relaxed pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
  if (block.type === "list") return (
    <div>
      {block.title && <p className="text-sm font-semibold mb-2">{block.title}</p>}
      <ul className="space-y-1.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return null;
}

// Plain HTML renderer for the complete-manual print/export view.
// Mirrors ContentBlock but uses simple tags that print cleanly.
function PrintBlock({ block }) {
  if (block.type === "intro") return <p style={{ margin: "0 0 8px", color: "#444" }}>{block.text}</p>;
  if (block.type === "note" || block.type === "tip" || block.type === "warning") {
    const label = block.type === "warning" ? "Warning" : block.type === "tip" ? "Tip" : "Note";
    return <p style={{ margin: "0 0 8px", padding: "6px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px" }}><strong>{label}:</strong> {block.text}</p>;
  }
  if (block.type === "steps") return (
    <div style={{ margin: "0 0 8px" }}>
      {block.title && <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{block.title}</p>}
      <ol style={{ margin: 0, paddingLeft: "20px" }}>
        {block.steps.map((s, i) => <li key={i} style={{ marginBottom: "3px" }}>{s}</li>)}
      </ol>
    </div>
  );
  if (block.type === "list") return (
    <div style={{ margin: "0 0 8px" }}>
      {block.title && <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{block.title}</p>}
      <ul style={{ margin: 0, paddingLeft: "20px", listStyle: "disc" }}>
        {block.items.map((item, i) => <li key={i} style={{ marginBottom: "3px" }}>{item}</li>)}
      </ul>
    </div>
  );
  return null;
}

export default function UserManualPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [activeSubsection, setActiveSubsection] = useState(SECTIONS[0].subsections[0].id);
  const [expandedSections, setExpandedSections] = useState(new Set([SECTIONS[0].id]));
  const [searchQ, setSearchQ] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    const results = [];
    SECTIONS.forEach((s) => {
      s.subsections.forEach((sub) => {
        const titleMatch = sub.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
        const contentMatch = sub.content.some((b) => {
          const text = b.text || b.title || "";
          const items = [...(b.steps || []), ...(b.items || [])];
          return text.toLowerCase().includes(q) || items.some((i) => i.toLowerCase().includes(q));
        });
        if (titleMatch || contentMatch) {
          results.push({ sectionId: s.id, sectionTitle: s.title, subId: sub.id, subTitle: sub.title });
        }
      });
    });
    return results;
  }, [searchQ]);

  const currentSection = SECTIONS.find((s) => s.id === activeSection);
  const currentSubsection = currentSection?.subsections.find((s) => s.id === activeSubsection);

  const toggleSection = (id) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const navigate = (sectionId, subId) => {
    setActiveSection(sectionId);
    setActiveSubsection(subId);
    setExpandedSections((prev) => new Set([...prev, sectionId]));
    setSearchQ("");
  };

  const printManual = () => {
    // The complete-manual container is always rendered (hidden via CSS) and
    // revealed only in print, so exporting works from any opened section.
    window.print();
  };

  return (
    <>
      <Helmet>
        <title>User Manual — TeNDA Land Registry</title>
        <meta name="description" content="Comprehensive user guide for the Techiman North District Assembly Land Registry System." />
      </Helmet>

      {/* Print styles: hide the interactive UI and reveal the COMPLETE manual */}
      <style>{`
        @media print {
          .manual-no-print { display: none !important; }
          .manual-print-only { display: block !important; }
          @page { margin: 16mm; }
          .manual-print-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 20px; }
          .manual-print-subsection { break-inside: avoid; page-break-inside: avoid; margin-bottom: 16px; }
        }
        .manual-print-only { display: none; }
      `}</style>

      <div className="manual-no-print">
      <PageHeader
        title="User Manual"
        subtitle="Complete guide to using the TeNDA Land Registry System"
        icon={BookOpen}
        action={
          <Button variant="outline" size="sm" onClick={printManual}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Export Full Manual
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar TOC */}
        <aside className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search manual…" className="pl-9 text-sm" />
          </div>

          {searchQ ? (
            <div className="rounded-xl border border-border bg-card p-2 space-y-1">
              <p className="px-2 py-1 text-xs text-muted-foreground font-medium">{searchResults.length} results</p>
              {searchResults.map((r) => (
                <button key={`${r.sectionId}-${r.subId}`}
                  onClick={() => navigate(r.sectionId, r.subId)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60 transition">
                  <p className="font-medium text-foreground truncate">{r.subTitle}</p>
                  <p className="text-xs text-muted-foreground">{r.sectionTitle}</p>
                </button>
              ))}
              {searchResults.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No results found.</p>}
            </div>
          ) : (
            <nav className="rounded-xl border border-border bg-card overflow-hidden">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isExpanded = expandedSections.has(section.id);
                return (
                  <div key={section.id} className="border-b border-border last:border-0">
                    <button onClick={() => { toggleSection(section.id); setActiveSection(section.id); }}
                      className={cn("flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium transition hover:bg-muted/40",
                        activeSection === section.id ? "bg-primary/5 text-primary" : "text-foreground")}>
                      <Icon className={cn("h-4 w-4 shrink-0", section.color)} />
                      <span className="flex-1 text-left text-xs leading-tight">{section.title}</span>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="bg-muted/20 pb-1">
                        {section.subsections.map((sub) => (
                          <button key={sub.id}
                            onClick={() => { setActiveSection(section.id); setActiveSubsection(sub.id); }}
                            className={cn("flex w-full items-center gap-2 py-2 pl-10 pr-4 text-xs transition hover:bg-muted/60",
                              activeSubsection === sub.id ? "text-primary font-semibold" : "text-muted-foreground")}>
                            <span className="truncate">{sub.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}

          {/* Version info */}
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Manual Version</p>
            <p>Version 2.0 — July 2026</p>
            <p>TeNDA Land Registry System</p>
            <p>Techiman North District Assembly</p>
          </div>
        </aside>

        {/* Content area */}
        <main className="min-w-0">
          {currentSubsection ? (
            <div className="space-y-6">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{currentSection?.title}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{currentSubsection.title}</span>
              </nav>

              {/* Content card */}
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Section header */}
                <div className={cn("px-6 py-5 border-b border-border flex items-center gap-3", currentSection?.bg)}>
                  {currentSection && React.createElement(currentSection.icon, { className: cn("h-6 w-6", currentSection.color) })}
                  <div>
                    <p className={cn("text-xs font-medium", currentSection?.color)}>{currentSection?.title}</p>
                    <h2 className="font-display text-lg font-bold">{currentSubsection.title}</h2>
                  </div>
                </div>

                {/* Content blocks */}
                <div className="p-6 space-y-5">
                  {currentSubsection.content.map((block, i) => (
                    <ContentBlock key={i} block={block} />
                  ))}
                </div>
              </div>

              {/* Navigation footer */}
              <div className="flex justify-between gap-3">
                {(() => {
                  const allSubs = SECTIONS.flatMap((s) => s.subsections.map((sub) => ({ ...sub, sectionId: s.id })));
                  const idx = allSubs.findIndex((s) => s.id === activeSubsection);
                  const prev = allSubs[idx - 1];
                  const next = allSubs[idx + 1];
                  return (
                    <>
                      {prev ? (
                        <Button variant="outline" size="sm" onClick={() => navigate(prev.sectionId, prev.id)}>
                          ← {prev.title}
                        </Button>
                      ) : <div />}
                      {next && (
                        <Button variant="outline" size="sm" onClick={() => navigate(next.sectionId, next.id)}>
                          {next.title} →
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-display text-xl font-semibold">Select a topic</p>
              <p className="text-sm text-muted-foreground mt-2">Choose a section from the table of contents to read the manual.</p>
            </div>
          )}
        </main>
      </div>
      </div>

      {/* ── Complete manual for print/export (all sections, always) ── */}
      <div className="manual-print-only">
        <div style={{ fontFamily: 'sans-serif', color: '#111', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '26px', marginBottom: '4px' }}>TeNDA Land Registry System — User Manual</h1>
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Techiman North District Assembly</p>
          <p style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>Complete guide — all sections. Generated {new Date().toLocaleDateString()}.</p>
          <p style={{ fontSize: '12px', color: '#777', marginBottom: '24px' }}>Contents: {SECTIONS.map((s) => s.title).join(' · ')}</p>
          {SECTIONS.map((section) => (
            <div key={section.id} className="manual-print-section">
              <h2 style={{ fontSize: '20px', borderBottom: '2px solid #1e3a8a', paddingBottom: '4px', marginBottom: '12px', color: '#1e3a8a' }}>
                {section.title}
              </h2>
              {section.subsections.map((sub) => (
                <div key={sub.id} className="manual-print-subsection">
                  <h3 style={{ fontSize: '15px', margin: '10px 0 6px', color: '#222' }}>{sub.title}</h3>
                  <div style={{ fontSize: '13px', lineHeight: '1.55' }}>
                    {sub.content.map((block, i) => (
                      <PrintBlock key={i} block={block} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
