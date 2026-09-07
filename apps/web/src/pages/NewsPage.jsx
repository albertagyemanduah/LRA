import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Calendar, Tag, ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import pb from "@/lib/pocketbaseClient";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 9;

function PostCard({ post, basePath }) {
  const imgUrl = post.featuredImage ? pb.files.getURL(post, post.featuredImage, { thumb: "600x400" }) : null;
  const cat = post.expand?.category;
  return (
    <Link
      to={`/${basePath}/${post.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-md transition"
    >
      <div className="relative h-48 bg-muted overflow-hidden">
        {imgUrl
          ? <img src={imgUrl} alt={post.title} className="h-full w-full object-cover transition group-hover:scale-105" />
          : <div className="h-full w-full flex items-center justify-center bg-primary/5">
              <Newspaper className="h-10 w-10 text-primary/20" />
            </div>}
        {cat && (
          <span
            className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ background: cat.color || "#2563eb" }}
          >
            {cat.name}
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-5 gap-2">
        <h3 className="font-display text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(post.publishedAt || post.created).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function NewsPage({ articleMode = false }) {
  const type = articleMode ? "article" : "news";
  const basePath = articleMode ? "articles" : "news";
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("q") || "";
  const cat = searchParams.get("cat") || "";

  const [searchInput, setSearchInput] = useState(search);

  const load = async () => {
    setLoading(true);
    try {
      const filters = [`type="${type}"`, `status="published"`];
      if (search) filters.push(`(title~"${search}" || excerpt~"${search}" || content~"${search}")`);
      if (cat) filters.push(`category="${cat}"`);

      const result = await pb.collection("news_posts").getList(page, PAGE_SIZE, {
        filter: filters.join(" && "),
        sort: "-publishedAt,-created",
        expand: "category",
        requestKey: `news-list-${type}-${page}-${search}-${cat}`,
      });
      setPosts(result.items);
      setTotal(result.totalItems);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const loadCats = async () => {
    try {
      const c = await pb.collection("news_categories").getFullList({ sort: "name", requestKey: "news-cats" });
      setCategories(c);
    } catch (_) {}
  };

  useEffect(() => { load(); }, [page, search, cat]);
  useEffect(() => { loadCats(); }, []);

  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    p.delete("page");
    setSearchParams(p);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{articleMode ? "Articles" : "News"} — Techiman North Land Registry</title>
        <meta name="description" content={`Latest ${articleMode ? "articles" : "news"} from Techiman North District Assembly`} />
      </Helmet>

      <PublicNav />

      {/* Hero */}
      <div className="bg-primary pt-24 pb-12 px-5">
        <div className="mx-auto max-w-[80rem]">
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            {articleMode ? "Articles" : "Latest News"}
          </h1>
          <p className="mt-2 text-primary-foreground/75 max-w-xl">
            {articleMode
              ? "In-depth articles and updates from Techiman North District Assembly"
              : "Latest news and announcements from Techiman North District Assembly"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[80rem] px-5 py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <form
            className="relative flex-1 min-w-[200px] max-w-sm"
            onSubmit={(e) => { e.preventDefault(); setParam("q", searchInput); }}
          >
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={`Search ${articleMode ? "articles" : "news"}...`}
              className="pl-9"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!cat ? "default" : "outline"}
              size="sm"
              onClick={() => setParam("cat", "")}
            >All</Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={cat === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setParam("cat", c.id)}
                style={cat === c.id ? { background: c.color } : {}}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-5 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No {articleMode ? "articles" : "news"} found</p>
            {(search || cat) && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchParams({}); setSearchInput(""); }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{total} {articleMode ? "article" : "news"}{total !== 1 ? "s" : ""} found</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => <PostCard key={p.id} post={p} basePath={basePath} />)}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <Button
                  variant="outline" size="icon"
                  disabled={page <= 1}
                  onClick={() => setParam("page", String(page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <Button
                      key={p}
                      variant={page === p ? "default" : "outline"}
                      size="icon"
                      onClick={() => setParam("page", String(p))}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline" size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setParam("page", String(page + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-12" />
      <StickyFooter />
    </div>
  );
}
