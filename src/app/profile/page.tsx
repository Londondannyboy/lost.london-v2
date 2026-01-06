'use client';

import { authClient } from '@/lib/auth/client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  email: string | null;
  preferred_name: string | null;
  favorite_topics: string[] | null;
  created_at: string;
}

export default function ProfilePage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    preferred_name: '',
    favorite_topics: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const response = await fetch('/api/user-profile');
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setFormData({
            preferred_name: data.preferred_name || '',
            favorite_topics: data.favorite_topics?.join(', ') || '',
          });
        }
      } catch (e) {
        console.error('Error fetching profile:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_name: formData.preferred_name,
          favorite_topics: formData.favorite_topics.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setEditing(false);
      }
    } catch (e) {
      console.error('Error saving profile:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = '/';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-800 mb-4">Please sign in</h1>
          <Link
            href="/auth/sign-in"
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to VIC
          </Link>
          <h1 className="text-xl font-bold text-stone-800">Your Profile</h1>
          <button
            onClick={handleSignOut}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-stone-600 mt-4">Loading profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">Account</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500">Email:</span>
                  <p className="text-stone-900">{user.email || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-stone-500">User ID:</span>
                  <p className="font-mono text-stone-900 text-xs break-all">{user.id}</p>
                </div>
              </div>
            </div>

            {/* Profile Settings */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-800">Profile Settings</h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">
                      What should VIC call you?
                    </label>
                    <input
                      type="text"
                      value={formData.preferred_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, preferred_name: e.target.value }))}
                      placeholder="e.g., Dan, Dr. Smith, etc."
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">
                      Favorite London topics (comma separated)
                    </label>
                    <input
                      type="text"
                      value={formData.favorite_topics}
                      onChange={(e) => setFormData(prev => ({ ...prev, favorite_topics: e.target.value }))}
                      placeholder="e.g., Victorian, Thames, Royal Aquarium"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 text-stone-600 hover:text-stone-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-stone-500">Preferred Name:</span>
                    <p className="text-stone-900">{profile?.preferred_name || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-stone-500">Favorite Topics:</span>
                    <p className="text-stone-900">
                      {profile?.favorite_topics?.length
                        ? profile.favorite_topics.join(', ')
                        : 'None set - VIC will suggest topics based on your conversations'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* VIC Tips */}
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h2 className="text-lg font-semibold text-amber-800 mb-2">Tips for talking to VIC</h2>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>&bull; Ask about specific places: &quot;Tell me about Thorney Island&quot;</li>
                <li>&bull; Explore eras: &quot;What was Victorian London like?&quot;</li>
                <li>&bull; Say &quot;Rosie&quot; for a special surprise</li>
                <li>&bull; VIC knows 370+ articles about London&apos;s hidden history</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
