import type { APIRoute } from 'astro';
import { loadSiteData } from '../../data/load';

export const GET: APIRoute = async () => {
  const { stats } = await loadSiteData();
  return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
};
