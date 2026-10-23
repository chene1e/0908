(function () {
  "use strict";
  const KEY = "bigGroupProfile";
  let sessionId = "";
  function makeId() {
    try { if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID(); } catch (_) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  function readRaw() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }
  function getProfile() {
    const profile = readRaw();
    if (!profile.playerId) {
      profile.playerId = sessionId || makeId();
      sessionId = profile.playerId;
      try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (_) {}
    } else {
      sessionId = profile.playerId;
    }
    return {
      playerId: String(profile.playerId),
      name: typeof profile.name === "string" ? profile.name.trim().slice(0, 40) : "",
      avatar: typeof profile.avatar === "string" ? profile.avatar : ""
    };
  }
  function saveProfile(patch) {
    const old = readRaw();
    if (!old.playerId) old.playerId = sessionId || makeId();
    sessionId = old.playerId;
    const next = Object.assign({}, old, patch || {}, { playerId: old.playerId });
    next.name = typeof next.name === "string" ? next.name.trim().slice(0, 40) : "";
    next.avatar = typeof next.avatar === "string" ? next.avatar : "";
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      return { ok: true, profile: getProfile() };
    } catch (error) {
      return { ok: false, error: error, profile: { playerId: next.playerId, name: next.name, avatar: next.avatar } };
    }
  }
  window.GameIdentity = {
    key: KEY,
    getProfile: getProfile,
    saveProfile: saveProfile,
    newId: makeId
  };
  getProfile();
})();