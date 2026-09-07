import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import {
  Newspaper, Plus, Pencil, Trash2, Eye, EyeOff, Search, Filter,
  Tag, ChevronDown, X, Image, Calendar, User, BarChart3, FileText,
  BookOpen, CheckCircle2, Clock, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function PostForm({ post, categories, onSave, onClose, type }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: post?.title || "",
    excerpt: post?.excerpt || "",
    content: post?.content || "",
    status: post?.status || "draft",
    category: post?.category || "",
    type: type,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    post?.featuredImage ? pb.files.getURL(post, post.featuredImage) : null
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("slug", slugify(form.title));
      fd.append("excerpt", form.excerpt);
      fd.append("content", form.content);
      fd.append("status", form.status);
      fd.append("type", form.type);
      if (form.category) fd.append("category", form.category);
      fd.append("author", user.id);
      if (form.status === "published" && !post?.publishedAt) {
        fd.append("publishedAt", new Date().toISOString().replace("T", " ").slice(0, 19));
      }
      if (imageFile) fd.append("featuredImage", imageFile);

      if (post?.id) {
        await pb.collection("news_posts").update(post.id, fd);
        toast({ title: "Post updated" });
      } else {
        await pb.collection("news_posts").create(fd);
        toast({ title: "Post created" });
      }
      onSave();
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Title *</label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={`${type === "news" ? "News" : "Article"} title`} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <Select value={form.category || "none"} onValueChange={(v) => set("category", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Excerpt</label>
          <textarea
            rows={2}
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            placeholder="Short summary shown in listings..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            rows={10}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Full content (HTML supported)..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Featured Image</label>
          <div className="flex items-start gap-3">
            {imagePreview && (
              <img src={imagePreview} alt="" className="h-20 w-28 rounded-lg object-cover border border-border" />
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Image className="h-4 w-4 mr-1.5" /> {imagePreview ? "Change" : "Upload"} Image
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — max 5 MB</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
          {post?.id ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );
}

function CategoryManager({ categories, onRefresh }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await pb.collection("news_categories").create({ name, description: desc, color, slug: slugify(name) });
      toast({ title: "Category created" });
      setName(""); setDesc(""); setColor("#2563eb");
      onRefresh();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this category?")) return;
    try {
      await pb.collection("news_categories").delete(id);
      onRefresh();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 bg-card space-y-3">
        <p className="font-medium text-sm">Add New Category</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />
          <div className="flex gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 rounded border border-input cursor-pointer" />
            <Button onClick={add} disabled={saving || !name.trim()} className="flex-1">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color || "#2563eb" }} />
              <span className="font-medium text-sm">{c.name}</span>
              {c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No categories yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}

export default function NewsManagementPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("news");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [formType, setFormType] = useState("news");

  // Stats
  const newsTotal = posts.filter((p) => p.type === "news").length;
  const newsPublished = posts.filter((p) => p.type === "news" && p.status === "published").length;
  const articleTotal = posts.filter((p) => p.type === "article").length;
  const articlePublished = posts.filter((p) => p.type === "article" && p.status === "published").length;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        pb.collection("news_posts").getFullList({ sort: "-created", expand: "category,author", requestKey: "np-all" }),
        pb.collection("news_categories").getFullList({ sort: "name", requestKey: "nc-all" }),
      ]);
      setPosts(p);
      setCategories(c);
    } catch (e) {
      toast({ title: "Load error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const openCreate = (type) => { setEditPost(null); setFormType(type); setFormOpen(true); };
  const openEdit = (post) => { setEditPost(post); setFormType(post.type); setFormOpen(true); };

  const deletePost = async (id) => {
    if (!confirm("Delete this post permanently?")) return;
    try {
      await pb.collection("news_posts").delete(id);
      toast({ title: "Post deleted" });
      loadAll();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const togglePublish = async (post) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    const update = { status: newStatus };
    if (newStatus === "published" && !post.publishedAt) {
      update.publishedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
    }
    try {
      await pb.collection("news_posts").update(post.id, update);
      toast({ title: newStatus === "published" ? "Published" : "Unpublished" });
      loadAll();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = (type) =>
    posts
      .filter((p) => p.type === type)
      .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.excerpt || "").toLowerCase().includes(search.toLowerCase()))
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => catFilter === "all" || p.category === catFilter);

  const PostList = ({ type }) => {
    const items = filtered(type);
    if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
    if (items.length === 0) return (
      <div className="py-16 text-center">
        <Newspaper className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No {type === "news" ? "news" : "articles"} found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreate(type)}>
          <Plus className="h-4 w-4 mr-1" /> Create first {type === "news" ? "news" : "article"}
        </Button>
      </div>
    );
    return (
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {items.map((p) => {
          const imgUrl = p.featuredImage ? pb.files.getURL(p, p.featuredImage, { thumb: "80x60" }) : null;
          const cat = categories.find((c) => c.id === p.category);
          return (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition">
              {imgUrl
                ? <img src={imgUrl} alt="" className="h-12 w-16 rounded-lg object-cover shrink-0 border border-border" />
                : <div className="h-12 w-16 rounded-lg bg-muted/50 flex items-center justify-center shrink-0"><Image className="h-5 w-5 text-muted-foreground/40" /></div>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight line-clamp-1">{p.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[p.status])}>
                    {p.status}
                  </span>
                  {cat && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: cat.color || "#2563eb" }} />
                      {cat.name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(p.created).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(p)} title={p.status === "published" ? "Unpublish" : "Publish"}>
                  {p.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-primary" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePost(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>News & Articles Management — Land Registry</title>
        <meta name="description" content="Manage news and articles for the public portal" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-primary" /> News & Articles
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage public-facing news and articles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openCreate("article")}>
              <BookOpen className="h-4 w-4 mr-1.5" /> New Article
            </Button>
            <Button onClick={() => openCreate("news")}>
              <Plus className="h-4 w-4 mr-1.5" /> New News
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total News", value: newsTotal, icon: Newspaper, color: "text-blue-600" },
            { label: "Published News", value: newsPublished, icon: CheckCircle2, color: "text-green-600" },
            { label: "Total Articles", value: articleTotal, icon: BookOpen, color: "text-purple-600" },
            { label: "Published Articles", value: articlePublished, icon: CheckCircle2, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted", s.color)}>
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold font-display">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadAll}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="news">
              <Newspaper className="h-4 w-4 mr-1.5" /> News ({newsTotal})
            </TabsTrigger>
            <TabsTrigger value="articles">
              <BookOpen className="h-4 w-4 mr-1.5" /> Articles ({articleTotal})
            </TabsTrigger>
            <TabsTrigger value="categories">
              <Tag className="h-4 w-4 mr-1.5" /> Categories ({categories.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="news" className="mt-4">
            <PostList type="news" />
          </TabsContent>
          <TabsContent value="articles" className="mt-4">
            <PostList type="article" />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoryManager categories={categories} onRefresh={loadAll} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editPost ? "Edit" : "Create"} {formType === "news" ? "News" : "Article"}
            </DialogTitle>
          </DialogHeader>
          {formOpen && (
            <PostForm
              post={editPost}
              categories={categories}
              type={formType}
              onSave={() => { setFormOpen(false); loadAll(); }}
              onClose={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
