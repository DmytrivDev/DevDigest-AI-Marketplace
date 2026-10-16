import type { APIRoute } from 'astro';
import { loadSiteData } from '../../data/load';

export const GET: APIRoute = async () => {
  const { changelog } = await loadSiteData();
  return new Response(JSON.stringify(changelog), { headers: { 'Content-Type': 'application/json' } });
};
