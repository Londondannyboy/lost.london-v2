'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Article {
  id: number;
  title: string;
  content: string;
  slug: string;
  excerpt: string | null;
  hero_image_url: string | null;
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setArticle(data.article);
        } else if (res.status === 404) {
          setError('Article not found');
        } else {
          setError('Failed to load article');
        }
      } catch (err) {
        console.error('Failed to fetch article:', err);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [slug]);

  const handleAskVIC = () => {
    if (article) {
      router.push(`/?topic=${encodeURIComponent(article.title)}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-64 bg-gray-200 rounded mb-6" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📜</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Article not found'}
            </h1>
            <p className="text-gray-500 mb-6">
              The article you're looking for doesn't exist or has been removed.
            </p>
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              Browse all articles
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <Link href="/articles" className="hover:text-gray-700">Articles</Link>
          <span>/</span>
          <span className="text-gray-700 truncate max-w-[200px]">{article.title}</span>
        </nav>

        {/* Article Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="text-xl text-gray-600 leading-relaxed">
              {article.excerpt}
            </p>
          )}
        </header>

        {/* Hero Image */}
        {article.hero_image_url && (
          <figure className="mb-8">
            <img
              src={article.hero_image_url}
              alt={article.title}
              className="w-full rounded-lg shadow-md"
            />
          </figure>
        )}

        {/* Article Content */}
        <article className="prose prose-stone prose-lg max-w-none mb-12">
          {article.content.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </article>

        {/* Ask VIC CTA */}
        <div className="bg-gradient-to-r from-stone-100 to-amber-50 rounded-xl p-6 border border-stone-200 mb-8">
          <h2 className="font-serif font-bold text-gray-900 text-xl mb-2">
            Want to learn more?
          </h2>
          <p className="text-gray-600 mb-4">
            Ask VIC for more details about {article.title} and related topics.
          </p>
          <button
            onClick={handleAskVIC}
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <span>🎙️</span>
            <span>Ask VIC about this</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t border-gray-200">
          <Link
            href="/articles"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to articles</span>
          </Link>

          <a
            href={`https://www.londonmylondon.co.uk`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Read more at londonmylondon.co.uk
          </a>
        </div>
      </main>
    </div>
  );
}
