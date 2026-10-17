#!/usr/bin/env node
// Prints the cumulative USD usage of the OpenRouter key in OPENROUTER_API_KEY (never the key).
const key = process.env.OPENROUTER_API_KEY;
if (!key) { console.error('OPENROUTER_API_KEY is not set'); process.exit(1); }
const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } });
const body = await res.json();
console.log((body.data ?? body).usage);
