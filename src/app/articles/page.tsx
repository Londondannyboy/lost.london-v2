'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  hero_image_url: string | null;
}

// Inner component that uses useSearchParams
function ArticlesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

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
        if (debouncedSearch) params.set('search', debouncedSearch);
        params.set('limit', '100');

        const res = await fetch(`/api/articles?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
          setTotal(data.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [debouncedSearch]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/articles${newUrl}`, { scroll: false });
  }, [debouncedSearch, router]);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-2">
          Browse Articles
        </h1>
        <p className="text-gray-600">
          Explore all {total} articles about London's hidden history
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles by title or content..."
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {debouncedSearch && (
          <p className="text-sm text-gray-500 mt-2">
            Showing {articles.length} results for "{debouncedSearch}"
          </p>
        )}
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200" />
              <div className="p-4">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/article/${article.slug}`}
              className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all"
            >
              {article.hero_image_url ? (
                <div className="h-40 overflow-hidden">
                  <img
                    src={article.hero_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="h-40 bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center">
                  <span className="text-4xl opacity-50">📜</span>
                </div>
              )}
              <div className="p-4">
                <h2 className="font-serif font-bold text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-2 mb-2">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {article.excerpt}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No articles found
          </h3>
          <p className="text-gray-500">
            {debouncedSearch
              ? `No articles match "${debouncedSearch}". Try a different search.`
              : 'No articles available.'}
          </p>
          {debouncedSearch && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-amber-700 hover:text-amber-800 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Back to VIC */}
      <div className="mt-12 text-center">
        <p className="text-gray-500 mb-3">Want to explore with guidance?</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
        >
          <span>🎙️</span>
          <span>Ask VIC</span>
        </Link>
      </div>
    </>
  );
}

// Loading fallback
function ArticlesLoading() {
  return (
    <>
      <div className="mb-8">
        <div className="h-10 bg-gray-200 rounded w-1/3 mb-2 animate-pulse" />
        <div className="h-5 bg-gray-200 rounded w-1/2 animate-pulse" />
      </div>
      <div className="mb-6">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
            <div className="h-40 bg-gray-200" />
            <div className="p-4">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-full mb-1" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Main page component with Suspense boundary
export default function ArticlesPage() {
  return (
    <div className="bg-stone-50 min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Suspense fallback={<ArticlesLoading />}>
          <ArticlesContent />
        </Suspense>
      </main>
    </div>
  );
}
