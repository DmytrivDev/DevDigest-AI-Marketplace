import type { APIRoute } from 'astro';
import { loadSiteData } from '../../data/load';

// Compact list for the unseen-releases counter (spec 8.4): id and date of the last 10 releases.
export const GET: APIRoute = async () => {
  const { changelog } = await loadSiteData();
  const body = { schemaVersion: 1, releases: changelog.releases.slice(0, 10).map((r) => ({ id: r.id, date: r.date })) };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
