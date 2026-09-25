/**
 * Words and phrases that are never allowed in usernames, bios, stories,
 * captions, replies or messages. This is a baseline: slurs and the most
 * extreme abuse. Extend it for your community (or set BLOCKLIST_EXTRA to a
 * comma-separated list) — keep entries lowercase.
 *
 * Content warning: this file intentionally contains offensive terms.
 */
export const BLOCKED_TERMS = [
  // Racial and ethnic slurs
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike', 'raghead', 'towelhead', 'coon', 'jigaboo', 'beaner', 'paki',
  // Homophobic / transphobic slurs
  'faggot', 'fag', 'dyke', 'tranny', 'shemale',
  // Ableist slurs
  'retard', 'retarded',
  // Violent abuse and threats
  'kill yourself', 'kys', 'go die', 'i will kill you', 'rape you',
  // Sexual exploitation of minors
  'child porn', 'cp links', 'jailbait', 'loli',
];
