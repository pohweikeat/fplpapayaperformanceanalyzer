/**
 * Papaya FPL Archive — Netlify Serverless Function
 * File path in your repo: netlify/functions/fpl-proxy.js
 *
 * Purpose: proxy requests to the FPL API server-side, bypassing the
 * CORS restriction that blocks direct browser fetches.
 *
 * Called by the Performance Analyzer as:
 *   /.netlify/functions/fpl-proxy?id=138582
 *
 * Returns: { current: [...], name: "Team Name" }
 *   current — array of GW objects for the current season:
 *     { event, points, total_points, rank, overall_rank, ... }
 *   name — the team name string, or null
 */

exports.handler = async (event) => {
  // 1. Extract manager ID from query string
  const id = event.queryStringParameters?.id;

  if (!id || !/^\d{1,8}$/.test(id)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or missing FPL Manager ID.' }),
    };
  }

  try {
    // 2. Fetch from FPL API (server-to-server — no CORS issue here)
    const fplRes = await fetch(
      `https://fantasy.premierleague.com/api/entry/${id}/history/`,
      {
        headers: {
          // FPL API occasionally checks User-Agent; a real browser value helps
          'User-Agent':
            'Mozilla/5.0 (compatible; PapayaFPL/1.0)',
        },
      }
    );

    if (fplRes.status === 404) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Manager ID ${id} not found. Double-check your FPL ID.` }),
      };
    }

    if (!fplRes.ok) {
      throw new Error(`FPL API returned HTTP ${fplRes.status}`);
    }

    const data = await fplRes.json();

    // 3. Return only what the frontend needs (current season GWs + team name)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Allow any origin — fine here since this is public FPL data
        'Access-Control-Allow-Origin': '*',
        // Cache for 5 minutes so rapid refreshes don't hammer the FPL API
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({
        current: data.current || [],   // array of { event, points, total_points, ... }
        name:    data.name    || null, // team name string
      }),
    };
  } catch (err) {
    console.error('[fpl-proxy] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Failed to fetch FPL data: ${err.message}`,
      }),
    };
  }
};
