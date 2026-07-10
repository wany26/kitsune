// Profile store: a small JSON-backed CRUD layer.
//
// A profile persists only its *inputs* (seed, presetId, overrides, proxy), never
// the derived fingerprint — the fingerprint is regenerated deterministically
// from the seed on every launch, so it stays byte-identical across sessions.
// Browser state (cookies, localStorage, IndexedDB) lives in a per-profile
// user-data dir so logged-in sessions survive relaunches.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { defaultProfileExtras, mergeConfig } from "./config.js";

// Storage lives in ~/.kitsune (override with KITSUNE_HOME). Installs from before
// the rename are migrated once, in place: the old ~/.fingerprint-browser
// directory is moved to ~/.kitsune so nothing is orphaned.
function resolveHome() {
  if (process.env.KITSUNE_HOME) return process.env.KITSUNE_HOME;
  const target = path.join(os.homedir(), ".kitsune");
  const legacy = path.join(os.homedir(), ".fingerprint-browser");
  if (!fs.existsSync(target) && fs.existsSync(legacy)) {
    try {
      fs.renameSync(legacy, target);
      process.stderr.write(`[kitsune] migrated data: ${legacy} -> ${target}\n`);
    } catch (e) {
      return legacy; // never lose data if the move fails (e.g. cross-device)
    }
  }
  return target;
}
const HOME = resolveHome();
const INDEX = path.join(HOME, "profiles.json");
const PROFILE_DATA_DIR = path.join(HOME, "profiles");

function ensureDirs() {
  fs.mkdirSync(PROFILE_DATA_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(INDEX, "utf8"));
  } catch (e) {
    return { profiles: [] };
  }
}

function save(db) {
  ensureDirs();
  fs.writeFileSync(INDEX, JSON.stringify(db, null, 2));
}

/** Fill in any missing extras/config so callers always see a complete profile. */
export function hydrateProfile(p) {
  if (!p) return p;
  const extras = defaultProfileExtras();
  return {
    ...extras,
    ...p,
    config: mergeConfig(p.config || {}),
  };
}

export function listProfiles() {
  return load().profiles.map(hydrateProfile);
}

export function getProfile(idOrName) {
  const { profiles } = load();
  const p = profiles.find((x) => x.id === idOrName || x.name === idOrName);
  return p ? hydrateProfile(p) : null;
}

export function userDataDir(profile) {
  return path.join(PROFILE_DATA_DIR, profile.id);
}

/**
 * Create a profile.
 * @param {object} opts
 * @param {string} [opts.name]      human label (defaults to the id)
 * @param {string} [opts.presetId]  force a device preset
 * @param {object} [opts.proxy]     proxy spec (see proxy/index.js)
 * @param {object} [opts.overrides] fingerprint field overrides
 * @param {string} [opts.seed]      explicit seed (else random, stable forever)
 */
export function createProfile(opts = {}) {
  const db = load();
  const id = crypto.randomUUID().slice(0, 8);
  const extras = defaultProfileExtras();
  const profile = {
    id,
    name: opts.name || id,
    seed: opts.seed || crypto.randomBytes(16).toString("hex"),
    engine: opts.engine || "chromium",
    presetId: opts.presetId || null,
    proxy: opts.proxy || { type: "none" },
    overrides: opts.overrides || {},
    createdAt: new Date().toISOString(),
    // Rich editor fields (see profile/config.js)
    os: opts.os || extras.os,
    uaOverride: opts.uaOverride ?? extras.uaOverride,
    note: opts.note ?? extras.note,
    cookies: opts.cookies || extras.cookies,
    startupUrls: opts.startupUrls || extras.startupUrls,
    accounts: opts.accounts || extras.accounts,
    ipQuery: opts.ipQuery || extras.ipQuery,
    config: mergeConfig(opts.config || {}),
  };
  if (db.profiles.some((p) => p.name === profile.name)) {
    throw new Error(`a profile named "${profile.name}" already exists`);
  }
  db.profiles.push(profile);
  save(db);
  return profile;
}

export function updateProfile(idOrName, patch) {
  const db = load();
  const p = db.profiles.find((x) => x.id === idOrName || x.name === idOrName);
  if (!p) throw new Error(`profile not found: ${idOrName}`);
  Object.assign(p, patch);
  save(db);
  return p;
}

export function deleteProfile(idOrName) {
  const db = load();
  const p = db.profiles.find((x) => x.id === idOrName || x.name === idOrName);
  if (!p) return false;
  db.profiles = db.profiles.filter((x) => x.id !== p.id);
  save(db);
  try {
    fs.rmSync(userDataDir(p), { recursive: true, force: true });
  } catch (e) {}
  return true;
}

export const paths = { HOME, INDEX, PROFILE_DATA_DIR };
