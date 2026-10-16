import type { ArtifactType } from '../lib/types';
import { stem } from './normalize';

// Type detection from the query (spec 6.2 step 4). Keys are normalized words; stems are tried too.

const WORDS: Record<string, ArtifactType> = {
  skill: 'skill', skills: 'skill', скіл: 'skill', скіли: 'skill', скілл: 'skill', скілу: 'skill', скіла: 'skill', навичка: 'skill', навичку: 'skill', навички: 'skill',
  agent: 'agent', agents: 'agent', агент: 'agent', агента: 'agent', агенти: 'agent', агентів: 'agent',
  command: 'command', commands: 'command', команда: 'command', команду: 'command', команди: 'command',
  hook: 'hook', hooks: 'hook', хук: 'hook', хуки: 'hook', хука: 'hook',
  mcp: 'mcp', server: 'mcp', servers: 'mcp', сервер: 'mcp', сервера: 'mcp',
  plugin: 'plugin', plugins: 'plugin', плагін: 'plugin', плагіни: 'plugin',
};

const STEMMED = new Map<string, ArtifactType>(Object.entries(WORDS).map(([w, t]) => [stem(w), t]));

export function typeOfWord(word: string): ArtifactType | null {
  return WORDS[word] ?? STEMMED.get(stem(word)) ?? null;
}
