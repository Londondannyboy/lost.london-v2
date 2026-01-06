import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.HUME_API_KEY;
  const secretKey = process.env.HUME_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: "Hume API credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Get access token from Hume
    const response = await fetch("https://api.hume.ai/oauth2-cc/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Hume Token] Error:", error);
      return NextResponse.json(
        { error: "Failed to get Hume token" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ accessToken: data.access_token });
  } catch (error) {
    console.error("[Hume Token] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
