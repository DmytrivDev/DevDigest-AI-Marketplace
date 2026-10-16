// Every internal URL goes through the Astro base (spec 2).

const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** url('plugins/devdigest/') -> '/DevDigest-AI-Marketplace/plugins/devdigest/' */
export function url(path = ''): string {
  const p = path.replace(/^\/+/, '');
  return `${base}/${p}`;
}

export const artifactPath = (plugin: string, type: string, slug: string): string =>
  `plugins/${plugin}/${type}/${slug}/`;
