import React, { useState, useEffect, useMemo } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  Menu, X, LogOut, Bell, ChevronDown, Circle,
  LayoutDashboard, MapPinned, Compass, FileText, ClipboardList,
  SearchCheck, Wallet, BarChart3, ShieldCheck, MessageSquare, UserCircle, LifeBuoy,
  RefreshCw, CheckCircle2, Palette, BookOpen, Network, KeyRound, Database,
  CheckCheck, Trash2, ArrowRight, Newspaper, ClipboardCheck, Menu as MenuIcon,
  GitBranch, BellRing, ArrowRightLeft, Send, Hash,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS = {
  LayoutDashboard, MapPinned, Compass, FileText, ClipboardList,
  SearchCheck, Wallet, BarChart3, ShieldCheck, MessageSquare, UserCircle, LifeBuoy, Palette,
  BookOpen, Bell, Network, KeyRound, Database, Newspaper, ClipboardCheck, Menu: MenuIcon,
  GitBranch, BellRing, ArrowRightLeft, Send, Hash,
};
import pb from "@/lib/pocketbaseClient";
import { AvatarDisplay } from "@/pages/dashboard/ProfilePage";
import { useAuth } from "@/lib/auth";
import { ROLES, MODULES, roleLabel, getUserModules } from "@/lib/roles";

// Default menu groups are sourced from roles.js (MODULE_GROUPS) via menuConfig.js.
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { loadBranding } from "@/lib/branding";
import { timeAgo } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PWAInstallButton } from "@/components/PWAInstallBanner";
import { useToast } from "@/hooks/use-toast";
import StickyFooter from "@/components/StickyFooter";
import ApprovalIndicator from "@/components/ApprovalIndicator";
import { loadMenuConfig, effectiveMenuForRole, defaultMenuConfig } from "@/lib/menuConfig";

function NavItem({ moduleKey, onNavigate }) {
  const m = MODULES[moduleKey];
  const Icon = ICONS[m.icon] || Circle;
  return (
    <NavLink
      to={m.path ? `/app/${m.path}` : "/app"}
      end={!m.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
          isActive
            ? "bg-sidebar-accent text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
        )
      }
    >
      <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
      {m.label}
    </NavLink>
  );
}

// Role switcher shown only when user has multiple roles
function RoleSwitcher({ role, roles, switchRole }) {
  const { toast } = useToast();
  if (!roles || roles.length <= 1) return null;

  const handleSwitch = async (newRole) => {
    if (newRole === role) return;
    await switchRole(newRole);
    toast({ title: "Role switched", description: `Now acting as: ${roleLabel(newRole)}` });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 h-8 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5">
          <RefreshCw className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{roleLabel(role)}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Switch Active Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => handleSwitch(r)}
            className={cn("cursor-pointer", r === role && "bg-primary/5 font-medium text-primary")}
          >
            <span className="flex items-center gap-2 w-full">
              {r === role && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              {r !== role && <span className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-sm">{roleLabel(r)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardLayout() {
  const { user, role, roles, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [menuConfig, setMenuConfig] = useState(defaultMenuConfig());

  // Modules for the current active role only (not all combined roles)
  // This makes the sidebar role-aware
  const activeModules = (ROLES[role]?.modules || []).filter(Boolean);
  // But also include all accessible modules via multi-role union for navigation completeness
  const allModules = getUserModules(roles.length > 0 ? roles : [role]).filter(Boolean);
  // Sidebar shows modules for the ACTIVE role
  const modules = activeModules.length > 0 ? activeModules : allModules;

  // Load admin-customized menu structure (groups, order, visibility)
  useEffect(() => {
    let mounted = true;
    loadMenuConfig().then((cfg) => { if (mounted) setMenuConfig(cfg); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Effective menu groups for the active role, respecting custom order/visibility
  const effectiveGroups = useMemo(
    () => effectiveMenuForRole(menuConfig, modules),
    [menuConfig, modules],
  );

  const loadNotifs = async () => {
    try {
      const list = await pb.collection("notifications").getFullList({
        filter: `user = "${user.id}"`, sort: "-created", requestKey: "notifs",
      });
      setNotifs(list);
    } catch (_) {}
  };

  useEffect(() => {
    if (user?.id) loadNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const toMark = notifs.filter((n) => !n.read);
    await Promise.all(
      toMark.map((n, i) => pb.collection("notifications").update(n.id, { read: true }, { requestKey: `nr-${i}` })),
    );
    loadNotifs();
  };

  const markOneRead = async (n) => {
    if (!n.read) {
      try {
        await pb.collection("notifications").update(n.id, { read: true }, { requestKey: `nr1-${n.id}` });
        setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      } catch (_) {}
    }
    setSelectedNotif(n);
  };

  const deleteNotif = async (id) => {
    try {
      await pb.collection("notifications").delete(id);
      setNotifs((prev) => prev.filter((x) => x.id !== id));
      if (selectedNotif?.id === id) setSelectedNotif(null);
    } catch (_) {}
  };

  const doLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="h-screen bg-secondary/30 flex flex-col">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5 bg-blue-700">
          <Link to="/app" className="flex items-center gap-2.5 text-white">
            {loadBranding().logoUrl
              ? <img src={loadBranding().logoUrl} alt="Logo" className="h-8 w-auto max-w-[7rem] rounded-lg object-contain" />
              : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-xs font-extrabold text-accent-foreground">TN</span>}
            <span className="font-display text-sm font-bold leading-tight">{loadBranding().appName || "Land Registry"}</span>
          </Link>
          <button onClick={() => setOpen(false)} className="text-sidebar-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-sidebar-border px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-accent">{ROLES[role]?.portal || "Portal"}</p>
          <p className="mt-0.5 text-sm font-medium text-white">{roleLabel(role)}</p>
          {/* Role switcher in sidebar for mobile */}
          {roles.length > 1 && (
            <div className="mt-2 space-y-1">
              {roles.filter((r) => r !== role).map((r) => (
                <button
                  key={r}
                  onClick={async () => {
                    await switchRole(r);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white transition"
                >
                  <RefreshCw className="h-3 w-3" />
                  Switch to: {roleLabel(r)}
                </button>
              ))}
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {effectiveGroups.map((group) => {
            const items = group.modules.filter((k) => modules.includes(k));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.label}</p>
                {items.map((k) => (
                  <NavItem key={k} moduleKey={k} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 space-y-1 pb-12">
          <NavLink
            to="/app/profile"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
              )
            }
          >
            <UserCircle className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
            My Profile
          </NavLink>
          <button
            onClick={doLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent/60 hover:text-white"
          >
            <LogOut className="h-4.5 w-4.5" strokeWidth={1.8} /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="text-foreground lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <RoleSwitcher role={role} roles={roles} switchRole={switchRole} />
            <ThemeToggle />
            <PWAInstallButton />
            {/* Pending approvals — red blinking indicator */}
            <ApprovalIndicator />
            {/* Notification bell */}
            <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifPanelOpen(true)}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Button>

            {/* Notification panel */}
            <Sheet open={notifPanelOpen} onOpenChange={setNotifPanelOpen}>
              <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
                <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Notifications
                      {unread > 0 && (
                        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                      )}
                    </SheetTitle>
                    <div className="flex items-center gap-2">
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex flex-1 overflow-hidden">
                  {/* Notification list */}
                  <div className={cn("flex flex-col border-r border-border transition-all", selectedNotif ? "w-[45%]" : "w-full")}>
                    <ScrollArea className="flex-1">
                      {notifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                          <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Actions and updates will appear here</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {notifs.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => markOneRead(n)}
                              className={cn(
                                "w-full text-left px-4 py-3 hover:bg-muted/40 transition block",
                                selectedNotif?.id === n.id && "bg-primary/5 border-l-2 border-l-primary",
                                !n.read && "bg-primary/[0.03]",
                              )}
                            >
                              <div className="flex items-start gap-2.5">
                                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                                {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm leading-snug", !n.read ? "font-medium" : "text-muted-foreground", selectedNotif ? "line-clamp-2 text-xs" : "line-clamp-3")}>
                                    {n.message}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created)}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Detail panel */}
                  {selectedNotif && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</p>
                        <button onClick={() => setSelectedNotif(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-foreground">{selectedNotif.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(selectedNotif.created).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          {selectedNotif.link && (
                            <button
                              onClick={() => { navigate(selectedNotif.link); setNotifPanelOpen(false); }}
                              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                              <ArrowRight className="h-3.5 w-3.5" /> View related page
                            </button>
                          )}
                          <div className="pt-3 border-t border-border">
                            <button
                              onClick={() => deleteNotif(selectedNotif.id)}
                              className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete notification
                            </button>
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-secondary">
                  <AvatarDisplay user={user} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-tight">{user?.fullName || "User"}</span>
                    <span className="block text-xs text-muted-foreground">{roleLabel(role)}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.fullName || "User"}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roles.length > 1 && (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground pb-0">Switch role</DropdownMenuLabel>
                    {roles.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => switchRole(r)}
                        className={cn("cursor-pointer text-sm", r === role && "font-semibold text-primary")}
                      >
                        {r === role && <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-primary" />}
                        {r !== role && <RefreshCw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />}
                        {roleLabel(r)}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate("/app/profile")}>
                  <UserCircle className="mr-2 h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16 sm:px-6 sm:py-8 sm:pb-16">
            <Outlet context={{ reloadNotifs: loadNotifs }} />
          </div>
        </main>
        <StickyFooter />
      </div>
    </div>
  );
}
