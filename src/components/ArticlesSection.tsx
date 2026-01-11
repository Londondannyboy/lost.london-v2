"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  hero_image_url: string | null;
}

// Predefined categories/eras for filtering
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "roman", label: "Roman" },
  { id: "medieval", label: "Medieval" },
  { id: "tudor", label: "Tudor" },
  { id: "georgian", label: "Georgian" },
  { id: "victorian", label: "Victorian" },
  { id: "river", label: "Rivers & Water" },
  { id: "theatre", label: "Theatre" },
  { id: "crime", label: "Crime & Mystery" },
];

interface ArticlesSectionProps {
  onArticleClick?: (article: Article) => void;
}

export function ArticlesSection({ onArticleClick }: ArticlesSectionProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch articles
  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        // Combine category and search
        const searchTerm = selectedCategory !== "all"
          ? `${selectedCategory} ${debouncedSearch}`.trim()
          : debouncedSearch;
        if (searchTerm) params.set("search", searchTerm);
        params.set("limit", "200"); // Get more for client-side filtering

        const res = await fetch(`/api/articles?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
          setTotal(data.total || 0);
        }
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [debouncedSearch, selectedCategory]);

  // Reset visible count when search/category changes
  useEffect(() => {
    setVisibleCount(12);
  }, [debouncedSearch, selectedCategory]);

  const handleArticleClick = useCallback((e: React.MouseEvent, article: Article) => {
    if (onArticleClick) {
      e.preventDefault();
      onArticleClick(article);
    }
  }, [onArticleClick]);

  const visibleArticles = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  return (
    <section className="py-12 bg-stone-50">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-1">
              Explore Articles
            </h2>
            <p className="text-gray-600">
              {total} stories of London&apos;s hidden history
            </p>
          </div>
          <Link
            href="/articles"
            className="text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 self-start md:self-auto"
          >
            View all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                  selectedCategory === category.id
                    ? "bg-amber-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-amber-400 hover:text-amber-700"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse shadow-sm">
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleArticles.map((article) => (
                <Link
                  key={article.id}
                  href={onArticleClick ? "#" : `/article/${article.slug}`}
                  onClick={(e) => handleArticleClick(e, article)}
                  className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {article.hero_image_url ? (
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-amber-100 to-stone-200 flex items-center justify-center">
                      <span className="text-3xl opacity-40">📜</span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-2 text-sm">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Load more button */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:border-amber-400 hover:text-amber-700 transition-colors font-medium"
                >
                  Load more ({articles.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-medium text-gray-900 mb-1">No articles found</h3>
            <p className="text-sm text-gray-500">
              {debouncedSearch || selectedCategory !== "all"
                ? "Try adjusting your search or filters"
                : "No articles available"}
            </p>
            {(debouncedSearch || selectedCategory !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-3 text-amber-700 hover:text-amber-800 font-medium text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
