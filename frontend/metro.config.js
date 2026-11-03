// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Dev-only: proxy /api/* through Metro to the local backend so a phone on
// Expo Go (via the Expo tunnel) can reach it without a separate public tunnel.
const http = require("http");
const DEV_BACKEND = process.env.DEV_BACKEND_PROXY || "http://127.0.0.1:8000";
config.server = config.server || {};
const prevEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = prevEnhance ? prevEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    if (!req.url || !req.url.startsWith("/api/")) return base(req, res, next);
    const target = new URL(req.url, DEV_BACKEND);
    const headers = { ...req.headers, host: target.host };
    const p = http.request(target, { method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    p.on("error", (e) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: `Thara backend not running (${e.code || e.message})` }));
    });
    req.pipe(p);
  };
};

module.exports = config;
