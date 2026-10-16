import type { APIRoute } from 'astro';
import { url } from '../lib/url';

// robots.txt (spec 7.9). On a project site it is only advisory: crawlers read the one at the domain root.
export const GET: APIRoute = ({ site }) => {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL(url('sitemap-index.xml'), site).href}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
