import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthServer } from '@/lib/auth/server';

// Lazy initialization - only connect at runtime, not build time
function getSql() {
  return neon(process.env.DATABASE_URL!);
}

// Ensure user_data table exists (runs once)
async function ensureTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS user_data (
      id SERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      preferred_name TEXT,
      favorite_topics TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const authServer = getAuthServer();
    if (!authServer) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
    }
    const { data } = await authServer.getSession();
    if (!data?.session || !data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = data.user;
    await ensureTable();

    const sql = getSql();
    const [profile] = await sql`
      SELECT * FROM user_data WHERE user_id = ${user.id}
    `;

    if (!profile) {
      // Create new profile
      const [newProfile] = await sql`
        INSERT INTO user_data (user_id, email)
        VALUES (${user.id}, ${user.email})
        RETURNING *
      `;
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authServer = getAuthServer();
    if (!authServer) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
    }
    const { data: sessionData } = await authServer.getSession();
    if (!sessionData?.session || !sessionData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = sessionData.user;
    await ensureTable();

    const sql = getSql();
    const data = await request.json();

    const [profile] = await sql`
      INSERT INTO user_data (user_id, email, preferred_name, favorite_topics, updated_at)
      VALUES (
        ${user.id},
        ${user.email},
        ${data.preferred_name || null},
        ${data.favorite_topics || null},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_name = EXCLUDED.preferred_name,
        favorite_topics = EXCLUDED.favorite_topics,
        updated_at = NOW()
      RETURNING *
    `;

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
