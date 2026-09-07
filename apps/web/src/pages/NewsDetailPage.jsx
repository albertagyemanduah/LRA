import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, ArrowLeft, Tag, User, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import pb from "@/lib/pocketbaseClient";
import PublicNav from "@/components/PublicNav";
import StickyFooter from "@/components/StickyFooter";

export default function NewsDetailPage({ articleMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = articleMode ? "articles" : "news";
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const p = await pb.collection("news_posts").getOne(id, {
          expand: "category,author",
          requestKey: `post-${id}`,
        });
        setPost(p);
        // load related
        try {
          const r = await pb.collection("news_posts").getList(1, 3, {
            filter: `type="${p.type}" && status="published" && id!="${id}"${p.category ? ` && category="${p.category}"` : ""}`,
            sort: "-created",
            expand: "category",
            requestKey: `related-${id}`,
          });
          setRelated(r.items);
        } catch (_) {}
      } catch (_) {
        navigate(`/${basePath}`);
      } finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNav />
        <div className="mx-auto max-w-3xl px-5 pt-24 pb-10 animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted rounded w-3/4" />
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const imgUrl = post.featuredImage ? pb.files.getURL(post, post.featuredImage) : null;
  const cat = post.expand?.category;
  const author = post.expand?.author;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{post.title} — Techiman North Land Registry</title>
        <meta name="description" content={post.excerpt || post.title} />
      </Helmet>

      <PublicNav />

      <article className="mx-auto max-w-3xl px-5 pt-24 pb-16">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to={`/${basePath}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to {articleMode ? "Articles" : "News"}
          </Link>
        </Button>

        {/* Category */}
        {cat && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white mb-4"
            style={{ background: cat.color || "#2563eb" }}
          >
            <Tag className="h-3 w-3" /> {cat.name}
          </span>
        )}

        {/* Title */}
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-balance mb-4">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-4 border-b border-border">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(post.publishedAt || post.created).toLocaleDateString("en-GH", { dateStyle: "long" })}
          </span>
          {author && (
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> {author.fullName || author.name || author.email}
            </span>
          )}
        </div>

        {/* Featured Image */}
        {imgUrl && (
          <div className="rounded-2xl overflow-hidden mb-8 border border-border">
            <img src={imgUrl} alt={post.title} className="w-full h-64 sm:h-96 object-cover" />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-6 font-medium">
            {post.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-display text-foreground"
          dangerouslySetInnerHTML={{ __html: post.content || "<p>No content available.</p>" }}
        />
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-[80rem] px-5 py-12">
            <h2 className="font-display text-xl font-bold mb-6">
              Related {articleMode ? "Articles" : "News"}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => {
                const rImg = p.featuredImage ? pb.files.getURL(p, p.featuredImage, { thumb: "600x400" }) : null;
                return (
                  <Link
                    key={p.id}
                    to={`/${basePath}/${p.id}`}
                    className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-md transition"
                  >
                    <div className="h-40 bg-muted overflow-hidden">
                      {rImg
                        ? <img src={rImg} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition" />
                        : <div className="h-full flex items-center justify-center"><Newspaper className="h-8 w-8 text-primary/20" /></div>}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition">
                        {p.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(p.publishedAt || p.created).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="h-12" />
      <StickyFooter />
    </div>
  );
}
