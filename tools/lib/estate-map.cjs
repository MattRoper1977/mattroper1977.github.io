'use strict';
// Read data/estate-map.json and answer: which origin serves this route?
//
// The map is generated from domain-split/education_policy.classifier -- see
// tools/estate/build_estate_map.py for why it is derived rather than written.
// This module and tools/lib/estate_map.py are the same predicate in two
// languages, and tools/sw2/check_estate_map.py proves they agree with the
// classifier route by route rather than assuming it.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT = path.resolve(__dirname, '../../data/estate-map.json');

function routeKey(value) {
  let p = decodeURIComponent(new URL(value, 'https://example.invalid').pathname);
  if (p.endsWith('index.html')) p = p.slice(0, -'index.html'.length);
  p = p.replace(/\/+$/, '');
  return p || '/';
}

class EstateMap {
  constructor(document) {
    this.education = document.origins.education;
    this.play = document.origins.play;
    this.educationHosts = new Set(document.hosts.education);
    this.playHosts = new Set(document.hosts.play);
    this.playNonGame = new Set(document.playNonGamePaths);
    this.prefixes = document.gamePathPrefixes;
    this.known = new Set(document.knownGameRoutes);
    this.directories = new Set(document.gameDirectories);
    this.retained = new Set(document.educationRetained);
    const excluded = document.educationExcluded;
    this.excludedPrefixes = excluded.prefixes;
    this.excludedExact = new Set(excluded.exact);
    this.videoPrefix = excluded.videoPrefix;
    this.videoStems = new Set(excluded.videoStems);
  }

  static load(file) {
    return new EstateMap(JSON.parse(fs.readFileSync(file || DEFAULT, 'utf8')));
  }

  isPlayRoute(value, prefix = '/') {
    const url = new URL(value, this.education + (prefix || '/'));
    const p = routeKey(url.href);
    if (this.playHosts.has(url.hostname)) return !this.playNonGame.has(p);
    if (!this.educationHosts.has(url.hostname) || this.retained.has(p)) return false;
    return this.known.has(p)
      || this.prefixes.some(prefix_ => p.startsWith(prefix_))
      || this.directories.has(p.replace(/^\/+|\/+$/g, '').split('/')[0]);
  }

  // The education publication does not carry this path at all.
  educationExcludes(value, prefix = '/') {
    const url = new URL(value, this.education + (prefix || '/'));
    if (!this.educationHosts.has(url.hostname)) return false;
    const p = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = p.split('/').pop() || '';
    const stem = file.includes('.') ? file.slice(0, file.lastIndexOf('.')) : file;
    return this.excludedPrefixes.some(prefix_ => p.startsWith(prefix_))
      || this.excludedExact.has(p)
      || (p.startsWith(this.videoPrefix) && this.videoStems.has(stem));
  }

  // The only correct way to choose a base for a request: a literal cannot know
  // that /townlife/ answers with a stub on education and the real page on Play,
  // nor that data/source-manifests/games.json is absent from education entirely.
  originFor(route, prefix = '/') {
    return (this.isPlayRoute(route, prefix) || this.educationExcludes(route, prefix))
      ? this.play : this.education;
  }

  describe(route, prefix = '/') {
    return `${route} lives on ${this.originFor(route, prefix)}`;
  }
}

module.exports = { EstateMap, routeKey, DEFAULT };
