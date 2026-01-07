'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InterestGraph } from '@/components/InterestGraph';

interface ZepFact {
  fact?: string;
}

interface UserProfile {
  preferred_name?: string;
  favorite_topics?: string[];
}

interface InterestWithCount {
  topic: string;
  count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [zepFacts, setZepFacts] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsWithCounts, setInterestsWithCounts] = useState<InterestWithCount[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect to sign-in if not logged in
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/auth/sign-in?redirect=/dashboard');
    }
  }, [isPending, session, router]);

  // Fetch user data
  useEffect(() => {
    if (session?.user?.id) {
      fetchZepData();
      fetchProfile();
    }
  }, [session?.user?.id]);

  const fetchZepData = async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch(`/api/zep/user?userId=${session.user.id}`);
      if (res.ok) {
        const data = await res.json();
        const facts = (data.facts || [])
          .map((f: ZepFact) => f.fact)
          .filter(Boolean);
        setZepFacts(facts);
        setInterests(data.interests || []);

        // Build interests with counts from facts
        const topicCounts = new Map<string, number>();
        facts.forEach((fact: string) => {
          // Extract topics from facts
          const topicMatches = fact.match(/interested in (.+)|discussed (.+)|asked about (.+)|explored (.+)/i);
          if (topicMatches) {
            const topic = (topicMatches[1] || topicMatches[2] || topicMatches[3] || topicMatches[4])
              .split(',')[0].trim();
            if (topic && topic.length > 2) {
              topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            }
          }
        });

        // Also count from interests array
        (data.interests || []).forEach((interest: string) => {
          topicCounts.set(interest, (topicCounts.get(interest) || 0) + 1);
        });

        const countsArray: InterestWithCount[] = Array.from(topicCounts.entries())
          .map(([topic, count]) => ({ topic, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setInterestsWithCounts(countsArray);
      }
    } catch (error) {
      console.error('Failed to fetch Zep data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user-profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const formatFactDate = (fact: string) => {
    // Extract any date-like patterns from the fact
    return 'Recently';
  };

  // Show loading while checking auth
  if (isPending || !session?.user) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 mt-4">Loading your dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-stone-700 to-stone-900 text-white rounded-xl p-8 mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
            My History
          </h1>
          <p className="text-white/80 mb-4">
            {profile?.preferred_name
              ? `Welcome back, ${profile.preferred_name}!`
              : 'Your conversations and discoveries with VIC'}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{zepFacts.length}</div>
              <div className="text-xs text-white/70">Insights</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{interests.length}</div>
              <div className="text-xs text-white/70">Interests</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">372</div>
              <div className="text-xs text-white/70">Articles</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Interest Graph */}
            {interestsWithCounts.length > 0 && (
              <InterestGraph
                interests={interestsWithCounts}
                userName={profile?.preferred_name || session?.user?.name?.split(' ')[0]}
              />
            )}

            {/* Interests Section */}
            {interests.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <h2 className="font-serif font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  Topics You've Explored
                </h2>
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/?topic=${encodeURIComponent(interest)}`)}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-gradient-to-r from-stone-100 to-amber-50 text-stone-700 border border-stone-200 hover:border-amber-300 hover:shadow-sm"
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite Topics from Profile */}
            {profile?.favorite_topics && profile.favorite_topics.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <h2 className="font-serif font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  Your Favorite Topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.favorite_topics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/?topic=${encodeURIComponent(topic)}`)}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* What VIC Remembers */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-serif font-bold text-gray-900 text-lg flex items-center gap-2">
                  What VIC Remembers About You
                </h2>
              </div>
              <div className="px-6 py-4">
                {zepFacts.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {zepFacts.map((fact, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-amber-500 mt-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </span>
                        <span className="text-sm text-gray-700 flex-1">{fact}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">💬</div>
                    <p className="text-sm text-gray-500 mb-3">
                      Have some conversations with VIC and your history will appear here
                    </p>
                    <Link
                      href="/"
                      className="inline-block text-sm text-amber-700 hover:text-amber-800 font-medium"
                    >
                      Talk to VIC
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 rounded-xl p-6">
              <h2 className="font-serif font-bold text-gray-900 text-lg mb-4">
                Continue Your Journey
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">🎙️</span>
                  <div>
                    <div className="font-medium text-gray-900">Talk to VIC</div>
                    <div className="text-xs text-gray-500">Voice or text chat</div>
                  </div>
                </Link>
                <Link
                  href="/articles"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">📚</span>
                  <div>
                    <div className="font-medium text-gray-900">Browse Articles</div>
                    <div className="text-xs text-gray-500">372 hidden stories</div>
                  </div>
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">⚙️</span>
                  <div>
                    <div className="font-medium text-gray-900">Edit Profile</div>
                    <div className="text-xs text-gray-500">Set your preferences</div>
                  </div>
                </Link>
                <a
                  href="https://www.waterstones.com/author/vic-keegan/4942784"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">📖</span>
                  <div>
                    <div className="font-medium text-gray-900">Buy the Books</div>
                    <div className="text-xs text-gray-500">Physical copies</div>
                  </div>
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
