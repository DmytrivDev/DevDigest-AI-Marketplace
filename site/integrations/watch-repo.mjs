import { resolve, sep } from 'node:path';

// Dev only: watch plugins/** and .claude-plugin/** (outside the Vite root) and rebuild the
// catalog on change, so adding a skill shows up without restarting the dev server.
export default function watchRepo(root) {
  const dirs = [resolve(root, 'plugins'), resolve(root, '.claude-plugin')];
  return {
    name: 'dd-watch-repo',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.watcher.add(dirs);
        const onChange = (file) => {
          const f = resolve(file);
          if (!dirs.some((d) => f === d || f.startsWith(d + sep))) return;
          globalThis.__ddDirty = true;
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: 'full-reload' });
        };
        for (const ev of ['add', 'change', 'unlink', 'addDir', 'unlinkDir']) server.watcher.on(ev, onChange);
      },
    },
  };
}
