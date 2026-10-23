(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cover = $("cover"), gameView = $("gameView"), leaderboardView = $("leaderboardView");
  const hextechLeaderboardView = $("hextechLeaderboardView");
  const hextechAverageLeaderboardView = $("hextechAverageLeaderboardView");
  const hextechLeaderboardList = $("hextechLeaderboardList");
  const hextechLeaderboardStatus = $("hextechLeaderboardStatus");
  let hextechLeaderboardRequest = 0;
  let hextechScoreSyncBusy = false;
  const hextechLocalScoresKey = "mergeHextechScoresV1";
  const hextechPendingScoresKey = "mergeHextechPendingScoresV1";
  const hextechLeaderboardCacheKey = "mergeHextechLeaderboardCacheV1";
  const libraryCover = $("libraryCover"), developmentView = $("developmentView");
  const nameInput = $("playerName"), avatarInput = $("avatarInput"), avatarPreview = $("avatarPreview"), avatarFallback = $("avatarFallback");
  const profileHint = $("profileHint"), leaderboardList = $("leaderboardList"), leaderboardStatus = $("leaderboardStatus");
  const config = window.LEADERBOARD_CONFIG || {};
  let avatarData = "";
  let currentScore = null;
  let scoreSubmitted = false;
  let currentSubmitRow = null;
  let pendingScoreSyncBusy = false;
  const pendingScoreQueueKey = "groupGamePendingScoresV1";
  let currentElapsedMs = null;
  let currentRoundWon = false;
  let rankingMode = "score";
  let rankingPage = 1;
  let cachedLeaderboardRows = [];
  const rankingPageSize = 10;
  const rankingCacheKey = "groupGameLeaderboardCacheV1";
  function readRankingCache(mode) { try { const cache = JSON.parse(sessionStorage.getItem(rankingCacheKey) || "{}"); return Array.isArray(cache[mode]) ? cache[mode] : null; } catch (_) { return null; } }
  function writeRankingCache(mode, rows) { try { const cache = JSON.parse(sessionStorage.getItem(rankingCacheKey) || "{}"); cache[mode] = rows; sessionStorage.setItem(rankingCacheKey, JSON.stringify(cache)); } catch (_) {} }

  function readProfile() {
    try { return JSON.parse(localStorage.getItem("bigGroupProfile") || "{}"); } catch (_) { return {}; }
  }
  function saveProfile() {
    const name = nameInput.value.trim();
    if (!name) { profileHint.textContent = "请先在游戏库首页设置全站昵称。"; window.location.href = "index.html#global-profile"; return false; }
    const saved = readProfile();
    // 未重新选择头像时保留之前保存的头像，避免被空字符串覆盖。
    const avatar = avatarData || saved.avatar || "";
    try { const playerId = saved.playerId || (window.GameIdentity ? window.GameIdentity.getProfile().playerId : ""); localStorage.setItem("bigGroupProfile", JSON.stringify(Object.assign({}, saved, { playerId, name, avatar }))); } catch (_) {
      profileHint.textContent = "资料保存失败，浏览器存储空间可能不足，请换一张更小的头像。";
      return false;
    }
    avatarData = avatar;
    profileHint.textContent = avatar ? "资料和头像已保存！开局冲分吧。" : "昵称已保存。上传头像后，头像才会显示在排行榜。";
    return true;
  }
  function getProfile() {
    const saved = readProfile();
    const shared = window.GameIdentity ? window.GameIdentity.getProfile() : saved; return { playerId: shared.playerId || saved.playerId || "", name: nameInput.value.trim() || saved.name || "神秘群友", avatar: avatarData || saved.avatar || "" };
  }
  function hasRemote() { return !!(config.supabaseUrl && config.supabaseAnonKey); }
  function localScores() {
    try { return JSON.parse(localStorage.getItem("bigGroupScores") || "[]"); } catch (_) { return []; }
  }
  function storeLocalScore(row) {
    const rows = localScores();
    rows.push(row);
    try { localStorage.setItem("bigGroupScores", JSON.stringify(rows)); } catch (_) {}
  }
  async function remoteRequest(path, options) {
    const opts = options || {};
    const method = String(opts.method || "GET").toUpperCase();
    const attempts = method === "GET" ? 3 : 1;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const headers = Object.assign({ apikey: config.supabaseAnonKey, "Content-Type": "application/json" }, opts.headers || {});
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;
      try {
        const requestOptions = Object.assign({}, opts, { headers });
        if (!opts.signal && controller) requestOptions.signal = controller.signal;
        const response = await fetch(config.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + path, requestOptions);
        if (!response.ok) {
          let detail = "";
          try { detail = await response.text(); } catch (_) {}
          const error = new Error("HTTP " + response.status + (detail ? ": " + detail.slice(0, 240) : ""));
          error.status = response.status;
          throw error;
        }
        if (response.status === 204) return [];
        const text = await response.text();
        return text ? JSON.parse(text) : [];
      } catch (error) {
        lastError = error;
        const retryable = method === "GET" && attempt < attempts - 1
          && (!error.status || error.status >= 500);
        if (!retryable) {
          if (error && error.name === "AbortError") throw new Error("云端请求超时（15 秒），请检查网络后重试。");
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    throw lastError || new Error("云端请求失败，请稍后重试。");
  }


  function readHextechLocalScores() {
    try { const rows = JSON.parse(localStorage.getItem(hextechLocalScoresKey) || "[]"); return Array.isArray(rows) ? rows.filter(row => row && row.run_id) : []; }
    catch (_) { return []; }
  }
  function storeHextechLocalScore(row) {
    const rows = readHextechLocalScores();
    if (!rows.some(item => item.run_id === row.run_id)) rows.push(row);
    try { localStorage.setItem(hextechLocalScoresKey, JSON.stringify(rows.slice(-30))); } catch (_) {}
  }
  function readHextechPendingScores() {
    try { const rows = JSON.parse(localStorage.getItem(hextechPendingScoresKey) || "[]"); return Array.isArray(rows) ? rows.filter(row => row && row.run_id) : []; }
    catch (_) { return []; }
  }
  function writeHextechPendingScores(rows) {
    try { localStorage.setItem(hextechPendingScoresKey, JSON.stringify(rows.slice(-20))); } catch (_) {}
  }
  function queueHextechScore(row) {
    const rows = readHextechPendingScores();
    if (!rows.some(item => item.run_id === row.run_id)) rows.push(row);
    writeHextechPendingScores(rows);
  }
  async function syncPendingHextechScores() {
    if (hextechScoreSyncBusy) return { ok:false, pending:readHextechPendingScores().length, error:new Error("海克斯成绩同步正在进行中。") };
    hextechScoreSyncBusy = true;
    try {
      if (!hasRemote()) throw new Error("云端数据库配置不可用。");
      while (true) {
        const queue = readHextechPendingScores();
        if (!queue.length) return { ok:true, pending:0 };
        const row = queue[0];
        let saved = false;
        let lastError = null;
        try {
          await remoteRequest("merge_hextech_scores", { method:"POST", headers:{ Prefer:"return=minimal" }, body:JSON.stringify(row) });
          saved = true;
        } catch (error) {
          lastError = error;
          try {
            const verify = await remoteRequest("merge_hextech_scores?select=run_id&run_id=eq." + encodeURIComponent(row.run_id) + "&limit=1");
            saved = Array.isArray(verify) && verify.some(item => String(item.run_id) === String(row.run_id));
          } catch (_) {}
        }
        if (!saved) return { ok:false, pending:queue.length, error:lastError || new Error("云端暂未确认这条海克斯成绩。") };
        writeHextechPendingScores(readHextechPendingScores().filter(item => item.run_id !== row.run_id));
      }
    } catch (error) {
      return { ok:false, pending:readHextechPendingScores().length, error };
    } finally { hextechScoreSyncBusy = false; }
  }
  window.submitHextechScore = async function (result) {
    const profile = getProfile();
    if (!profile.name || profile.name === "神秘群友") return { ok:false, localSaved:false, pending:0, error:new Error("请先设置全站昵称。") };
    const runId = window.GameIdentity && typeof window.GameIdentity.newId === "function"
      ? window.GameIdentity.newId()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); });
    const row = {
      run_id:runId, player_id:profile.playerId || null, name:profile.name.slice(0,40), avatar:profile.avatar || "",
      score:Math.max(0,Math.floor(Number(result && result.score) || 0)),
      merge_count:Math.max(0,Math.floor(Number(result && result.merge_count) || 0)),
      highest_level:Math.min(9,Math.max(1,Math.floor(Number(result && result.highest_level) || 1))),
      augments:Array.isArray(result && result.augments) ? result.augments.slice(0,3) : [],
      created_at:new Date().toISOString()
    };
    storeHextechLocalScore(row);
    queueHextechScore(row);
    if (!hasRemote()) return { ok:false, localSaved:true, pending:readHextechPendingScores().length, error:new Error("云端数据库配置不可用。") };
    const sync = await syncPendingHextechScores();
    return { ok:sync.ok, localSaved:true, pending:sync.pending, error:sync.error, row };
  };
  function renderHextechLeaderboard(rows) {
    if (!hextechLeaderboardList) return;
    hextechLeaderboardList.replaceChildren();
    const sorted = (Array.isArray(rows) ? rows : []).slice()
      .sort((a,b) => Number(b.score || 0) - Number(a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")))
      .slice(0,20);
    if (!sorted.length) {
      const li = document.createElement("li"); li.className = "hextech-ranking-empty";
      li.textContent = "还没有海克斯成绩，来打出第一份强化构筑记录吧！";
      hextechLeaderboardList.appendChild(li); return;
    }
    sorted.forEach((row,index) => {
      const li = document.createElement("li"); li.className = "hextech-rank-row";
      const rank = document.createElement("span"); rank.className = "hextech-rank-number";
      rank.textContent = index < 3 ? ["🥇","🥈","🥉"][index] : String(index+1);
      const img = document.createElement("img"); img.className = "hextech-rank-avatar"; img.alt = ""; img.loading = "lazy";
      const fallbackAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23f4ead8'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-size='34'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
      img.src = row.avatar || fallbackAvatar;
      img.addEventListener("error", function () { this.onerror=null; this.src=fallbackAvatar; });
      const info = document.createElement("div"); info.className = "hextech-rank-info";
      const name = document.createElement("strong"); name.className = "hextech-rank-name"; name.textContent = row.name || "神秘群友";
      const meta = document.createElement("small"); meta.className = "hextech-rank-meta";
      const when = row.created_at ? new Date(row.created_at).toLocaleString() : "本机记录";
      meta.textContent = "最高等级 Lv." + Number(row.highest_level || 1) + " · 合成 " + Number(row.merge_count || 0) + " 次 · " + when;
      info.append(name,meta);
      const build = document.createElement("div"); build.className = "hextech-rank-build";
      const augments = Array.isArray(row.augments) ? row.augments : [];
      augments.slice(0,3).forEach(augment => {
        const chip = document.createElement("span"); chip.title = augment.description || augment.name || "";
        chip.textContent = augment.name || augment.id || "海克斯强化"; build.appendChild(chip);
      });
      if (!augments.length) { const chip = document.createElement("span"); chip.textContent = "未记录强化"; build.appendChild(chip); }
      info.appendChild(build);
      const metric = document.createElement("strong"); metric.className = "hextech-rank-score";
      metric.textContent = Number(row.score || 0).toLocaleString() + " 分";
      li.append(rank,img,info,metric); hextechLeaderboardList.appendChild(li);
    });
  }
  async function loadHextechLeaderboard() {
    if (!hextechLeaderboardStatus) return;
    const requestId = ++hextechLeaderboardRequest;
    hextechLeaderboardStatus.textContent = "正在读取海克斯全球排行榜…";
    const cached = (() => { try { return JSON.parse(sessionStorage.getItem(hextechLeaderboardCacheKey) || "null"); } catch (_) { return null; } })();
    if (Array.isArray(cached)) renderHextechLeaderboard(cached);
    try {
      if (!hasRemote()) throw new Error("云端数据库配置不可用。");
      await syncPendingHextechScores();
      const rows = await remoteRequest("merge_hextech_scores?select=run_id,player_id,name,avatar,score,merge_count,highest_level,augments,created_at&order=score.desc,created_at.asc&limit=20");
      if (requestId !== hextechLeaderboardRequest) return;
      renderHextechLeaderboard(rows);
      try { sessionStorage.setItem(hextechLeaderboardCacheKey, JSON.stringify(rows)); } catch (_) {}
      hextechLeaderboardStatus.textContent = "海克斯全球榜 · 前 " + rows.length + " 名；仅统计海克斯模式，成绩按分数从高到低排序。";
    } catch (error) {
      if (requestId !== hextechLeaderboardRequest) return;
      const local = readHextechLocalScores().sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,20);
      renderHextechLeaderboard(local);
      const detail = error && error.message ? String(error.message).slice(0,100) : "网络连接失败";
      hextechLeaderboardStatus.textContent = "⚠ 云端排行榜暂不可用（" + detail + "）。当前显示的是本机记录，不代表全球排名。";
    }
  }
  function renderHextechAverageLeaderboard(rows) {
    const list = $("hextechAverageLeaderboardList");
    if (!list) return;
    list.replaceChildren();
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const name = String(row.name || "神秘群友").trim() || "神秘群友";
      const key = row.player_id ? "id:" + row.player_id : "name:" + name.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, { name, avatar:row.avatar || "", runs:0, total:0, best:0, latest:row.created_at || "" });
      const group = groups.get(key);
      group.runs++;
      group.total += Math.max(0, Number(row.score) || 0);
      group.best = Math.max(group.best, Math.max(0, Number(row.score) || 0));
      if (row.created_at && row.created_at > group.latest) group.latest = row.created_at;
      if (!group.avatar && row.avatar) group.avatar = row.avatar;
      if (row.created_at && (!group.name || group.name === "神秘群友")) group.name = name;
    });
    const ranked = Array.from(groups.values()).filter(player => player.runs >= 3)
      .map(player => Object.assign(player, { average:player.total / player.runs }))
      .sort((a,b) => b.average - a.average || b.runs - a.runs || b.best - a.best)
      .slice(0,20);
    if (!ranked.length) {
      const li = document.createElement("li"); li.className = "hextech-ranking-empty";
      li.textContent = "暂时还没有满足上榜条件的玩家。完成 3 局海克斯模式后，就能参与平均分排名！";
      list.appendChild(li); return;
    }
    ranked.forEach((player,index) => {
      const li = document.createElement("li"); li.className = "hextech-rank-row";
      const rank = document.createElement("span"); rank.className = "hextech-rank-number";
      rank.textContent = index < 3 ? ["🥇","🥈","🥉"][index] : String(index+1);
      const img = document.createElement("img"); img.className = "hextech-rank-avatar"; img.alt = ""; img.loading = "lazy";
      const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23f4ead8'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-size='34'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
      img.src = player.avatar || fallback;
      img.addEventListener("error", function(){this.onerror=null;this.src=fallback;});
      const info = document.createElement("div"); info.className = "hextech-rank-info";
      const name = document.createElement("strong"); name.className = "hextech-rank-name"; name.textContent = player.name;
      const meta = document.createElement("small"); meta.className = "hextech-rank-meta";
      meta.textContent = "有效局数 " + player.runs + " · 个人最高 " + player.best.toLocaleString() + " 分";
      info.append(name,meta);
      const metric = document.createElement("div"); metric.className = "hextech-average-metric";
      const average = document.createElement("strong"); average.textContent = Math.round(player.average).toLocaleString() + " 分/局";
      const runs = document.createElement("small"); runs.textContent = "平均分";
      metric.append(average,runs);
      li.append(rank,img,info,metric); list.appendChild(li);
    });
  }
  async function loadHextechAverageLeaderboard() {
    const status = $("hextechAverageLeaderboardStatus");
    if (!status) return;
    status.textContent = "正在统计全球平均分…";
    const cached = (() => { try { return JSON.parse(sessionStorage.getItem("mergeHextechAverageLeaderboardCacheV1") || "null"); } catch (_) { return null; } })();
    if (Array.isArray(cached)) renderHextechAverageLeaderboard(cached);
    try {
      if (!hasRemote()) throw new Error("云端数据库配置不可用。");
      await syncPendingHextechScores();
      const allRows = [];
      const pageSize = 1000;
      const maxRows = 20000;
      for (let offset = 0; offset < maxRows; offset += pageSize) {
        const batch = await remoteRequest(
          "merge_hextech_scores?select=player_id,name,score,created_at&order=created_at.desc&limit=" + pageSize + "&offset=" + offset
        );
        if (!Array.isArray(batch)) throw new Error("云端返回的数据格式不正确。");
        allRows.push(...batch);
        if (batch.length < pageSize) break;
      }
      renderHextechAverageLeaderboard(allRows);
      try { sessionStorage.setItem("mergeHextechAverageLeaderboardCacheV1", JSON.stringify(allRows)); } catch (_) {}
      status.textContent = "已统计 " + allRows.length.toLocaleString() + " 局海克斯成绩；每位玩家至少 3 局，按平均分排序。";
      if (allRows.length >= maxRows) status.textContent += " 当前按最近 20,000 条成绩估算平均分。";
    } catch (error) {
      const localRows = readHextechLocalScores();
      renderHextechAverageLeaderboard(localRows);
      const detail = error && error.message ? String(error.message).slice(0,100) : "网络连接失败";
      status.textContent = "⚠ 云端统计暂不可用（" + detail + "）。当前仅按本机历史记录统计，不代表全球排名。";
    }
  }

  function formatElapsed(ms) {
    const seconds = Number(ms) / 1000;
    return Number.isFinite(seconds) && seconds >= 0 ? seconds.toFixed(2) + " 秒" : "—";
  }
  function renderRows(rows, mode) {
    leaderboardList.innerHTML = "";
    const eligible = mode === "time" ? rows.filter(row => row.elapsed_ms !== null && row.elapsed_ms !== undefined && Number.isFinite(Number(row.elapsed_ms))) : rows;
    const sorted = eligible.slice().sort((a, b) => {
      const primary = mode === "time" ? Number(a.elapsed_ms) - Number(b.elapsed_ms) : Number(b.score) - Number(a.score);
      if (primary) return primary;
      const dateOrder = String(a.created_at || "").localeCompare(String(b.created_at || ""));
      return dateOrder || String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
    });
    const pageCount = Math.max(1, Math.ceil(sorted.length / rankingPageSize));
    rankingPage = Math.min(Math.max(1, rankingPage), pageCount);
    const pageInfo = $("leaderboardPageInfo");
    const prevBtn = $("leaderboardPrevBtn");
    const nextBtn = $("leaderboardNextBtn");
    if (pageInfo) pageInfo.textContent = "第 " + rankingPage + " / " + pageCount + " 页 · 共 " + sorted.length + " 条";
    if (prevBtn) prevBtn.disabled = rankingPage <= 1;
    if (nextBtn) nextBtn.disabled = rankingPage >= pageCount;
    if (!sorted.length) {
      const li = document.createElement("li");
      li.className = "empty-ranking";
      li.textContent = mode === "time" ? "还没有群友合成 Level 9，快来争夺最快通关！" : "还没有成绩，快来成为第一位上榜的群友！";
      leaderboardList.appendChild(li);
      return;
    }
    sorted.slice((rankingPage - 1) * rankingPageSize, rankingPage * rankingPageSize).forEach((row, pageIndex) => {
      const index = (rankingPage - 1) * rankingPageSize + pageIndex;
      const li = document.createElement("li");
      const rank = document.createElement("span"); rank.className = "rank-number"; rank.textContent = index < 3 ? ["🥇","🥈","🥉"][index] : String(index + 1);
      const img = document.createElement("img"); img.className = "rank-avatar"; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = row.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23f3eadc'/%3E%3Ctext x='50%25' y='58%25' font-size='42' text-anchor='middle'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
      img.addEventListener("error", function () { this.onerror = null; this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23f3eadc'/%3E%3Ctext x='50%25' y='58%25' font-size='42' text-anchor='middle'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E"; });
      const info = document.createElement("div"); info.className = "rank-info";
      const name = document.createElement("div"); name.className = "rank-name"; name.textContent = row.name || "神秘群友";
      const time = document.createElement("div"); time.className = "rank-time"; time.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : "本机记录";
      info.append(name, time);
      const metric = document.createElement("span"); metric.className = "rank-score";
      metric.textContent = mode === "time" ? formatElapsed(row.elapsed_ms) : Number(row.score) + "分";
      li.append(rank, img, info, metric); leaderboardList.appendChild(li);
    });
  }
  function setRankingMode(mode) {
    rankingMode = mode;
    $("scoreLeaderboardTab").classList.toggle("active", mode === "score");
    $("timeLeaderboardTab").classList.toggle("active", mode === "time");
    $("scoreLeaderboardTab").setAttribute("aria-pressed", String(mode === "score"));
    $("timeLeaderboardTab").setAttribute("aria-pressed", String(mode === "time"));
    loadLeaderboard();
  }
  async function loadLeaderboard() {
    rankingPage = 1;
    const cached = readRankingCache(rankingMode);
    if (cached) {
      cachedLeaderboardRows = cached;
      renderRows(cached, rankingMode);
      leaderboardStatus.textContent = "显示缓存排行榜，正在后台更新…";
    } else {
      leaderboardStatus.textContent = "正在读取排行榜…";
    }
    try {
      if (hasRemote()) {
        // 直接在排行榜请求中读取 avatar，避免单独头像请求被 RLS/列权限拦截后静默退回默认头像。
        // 排行榜只取前 20 条，确保已有历史头像继续正常显示。
        const rankingQuery = rankingMode === "time"
          ? "game_scores?select=id,name,avatar,score,elapsed_ms,created_at&elapsed_ms=not.is.null&order=elapsed_ms.asc,created_at.asc,name.asc&limit=20"
          : "game_scores?select=id,name,avatar,score,elapsed_ms,created_at&order=score.desc,created_at.asc,name.asc&limit=20";
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
        let rows;
        try { rows = await remoteRequest(rankingQuery, controller ? { signal: controller.signal } : undefined); }
        finally { if (timeout) clearTimeout(timeout); }
        cachedLeaderboardRows = rows;
        writeRankingCache(rankingMode, rows);
        renderRows(rows, rankingMode);
        leaderboardStatus.textContent = rankingMode === "time"
          ? "在线全球榜 · 仅统计成功合成 Level 9 的成绩，时间越短排名越高"
          : "在线全球榜 · 每局成绩独立记录，分数越高排名越高";
      } else {
        cachedLeaderboardRows = localScores();
        renderRows(cachedLeaderboardRows, rankingMode);
        leaderboardStatus.textContent = "当前为本机预览榜；配置在线数据库后，所有人才能共享成绩。";
      }
    } catch (loadError) {
      if (!cached) {
        cachedLeaderboardRows = localScores();
        renderRows(cachedLeaderboardRows, rankingMode);
      }
      const detail = loadError && loadError.message ? String(loadError.message).slice(0, 100) : "网络连接失败";
      leaderboardStatus.textContent = cached
        ? "已显示缓存排行榜；云端更新失败（" + detail + "），可稍后刷新。"
        : "⚠ 在线排行榜读取失败（" + detail + "），当前显示本机记录（不代表全球榜）。请检查网络后刷新。";
    }
  }

  function readPendingScoreQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(pendingScoreQueueKey) || "[]");
      return Array.isArray(value) ? value.filter(row => row && row.created_at && row.score !== undefined) : [];
    } catch (_) { return []; }
  }
  function writePendingScoreQueue(rows) {
    try { localStorage.setItem(pendingScoreQueueKey, JSON.stringify(rows.slice(-100))); } catch (_) {}
  }
  function queueScoreRow(row) {
    const queue = readPendingScoreQueue();
    if (!queue.some(item => item.player_id === row.player_id && item.created_at === row.created_at)) queue.push(row);
    writePendingScoreQueue(queue);
  }
  async function syncPendingScoreQueue() {
    if (pendingScoreSyncBusy) return { ok: false, error: new Error("成绩同步正在进行中。"), pending: readPendingScoreQueue().length };
    pendingScoreSyncBusy = true;
    try {
      if (!hasRemote()) throw new Error("云端数据库配置不可用。");
      while (true) {
        const queue = readPendingScoreQueue();
        if (!queue.length) return { ok: true, pending: 0 };
        const row = queue[0];
        let saved = false;
        let lastError = null;
        try {
          await remoteRequest("game_scores", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(row)
          });
          saved = true;
        } catch (error) {
          lastError = error;
          // The server may have committed before a connection dropped; verify this exact record before retrying.
          try {
            const verify = await remoteRequest(
              "game_scores?select=id,player_id,score,created_at"
              + "&player_id=eq." + encodeURIComponent(String(row.player_id || ""))
              + "&score=eq." + encodeURIComponent(String(row.score))
              + "&created_at=eq." + encodeURIComponent(row.created_at)
              + "&limit=1"
            );
            saved = Array.isArray(verify) && verify.some(item =>
              String(item.player_id || "") === String(row.player_id || "")
              && Number(item.score) === Number(row.score)
              && String(item.created_at || "") === String(row.created_at)
            );
          } catch (_) {}
        }
        if (!saved) return { ok: false, error: lastError || new Error("上传未被云端确认。"), pending: queue.length };
        writePendingScoreQueue(readPendingScoreQueue().filter(item =>
          !(item.player_id === row.player_id && item.created_at === row.created_at)
        ));
      }
    } catch (error) {
      return { ok: false, error, pending: readPendingScoreQueue().length };
    } finally {
      pendingScoreSyncBusy = false;
    }
  }
  window.finishAndOfferScore = function (score, elapsedMs, wonRound) {
    currentScore = Number(score) || 0;
    currentElapsedMs = elapsedMs !== null && elapsedMs !== undefined && Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : null;
    currentRoundWon = wonRound === true && currentElapsedMs !== null;
    scoreSubmitted = false;
    currentSubmitRow = null;
    $("submitScoreHint").textContent = currentRoundWon
      ? "本局得分：" + currentScore + "。通关用时：" + formatElapsed(currentElapsedMs) + "。一次提交即可记录分数和最快通关成绩。"
      : "本局得分：" + currentScore + "。点击提交，将成绩加入分数排行榜。合成 Level 9 后才会计入时间排行榜。";
    $("submitScoreBtn").disabled = false;
    $("submitScoreBtn").textContent = "提交本局成绩";
    $("scoreSubmitArea").classList.remove("hidden");
  };
  $("submitScoreBtn").addEventListener("click", async function () {
    if (currentScore === null || scoreSubmitted) return;
    const profile = getProfile();
    if (!profile.name || profile.name === "神秘群友") {
      $("submitScoreHint").textContent = "请先返回封面设置群昵称，再提交成绩。";
      return;
    }
    if (!currentSubmitRow) {
      currentSubmitRow = {
        player_id: profile.playerId || null,
        name: profile.name,
        avatar: profile.avatar || "",
        score: currentScore,
        elapsed_ms: currentRoundWon ? currentElapsedMs : null,
        created_at: new Date().toISOString()
      };
      storeLocalScore(currentSubmitRow);
      queueScoreRow(currentSubmitRow);
    }
    this.disabled = true;
    this.textContent = "提交中…";
    $("submitScoreHint").textContent = "正在同步成绩；若网络中断，记录会保存在本机并自动补传。";
    const result = await syncPendingScoreQueue();
    if (result.ok) {
      scoreSubmitted = true;
      this.disabled = true;
      this.textContent = "已提交";
      $("submitScoreHint").textContent = "✓ 成绩已确认写入全球排行榜！";
      return;
    }
    const detail = result.error && result.error.message ? String(result.error.message).slice(0, 160) : "网络连接失败";
    $("submitScoreHint").textContent = "云端上传失败：" + detail + "。已保留 " + result.pending + " 条待上传成绩，请检查网络后重试。";
    this.disabled = false;
    this.textContent = "重新上传待提交成绩";
  });
  avatarInput.addEventListener("change", function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { profileHint.textContent = "请选择图片文件。"; this.value = ""; return; }
    const reader = new FileReader();
    reader.onerror = function () { profileHint.textContent = "头像读取失败，请重新选择图片。"; };
    reader.onload = function () {
      const source = new Image();
      source.onerror = function () { profileHint.textContent = "图片无法识别，请换一张图片。"; };
      source.onload = function () {
        // 压缩成小尺寸 JPEG，避免头像过大导致数据库拒收或本地资料存储失败。
        const canvas = document.createElement("canvas");
        const maxSide = 128;
        const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        avatarData = canvas.toDataURL("image/jpeg", 0.55);
        if (avatarData.length > 60000) avatarData = canvas.toDataURL("image/jpeg", 0.4);
        avatarPreview.src = avatarData;
        avatarPreview.hidden = false;
        avatarFallback.classList.add("hidden");
        profileHint.textContent = "头像已读取并压缩，点击“保存玩家资料”后再提交成绩。";
      };
      source.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $("saveProfileBtn").addEventListener("click", saveProfile);
  const classicModeBtn = $("classicModeBtn");
  const hextechModeBtn = $("hextechModeBtn");
  const mergeModeHint = $("mergeModeHint");
  window.mergeGameMode = "classic";
  function selectMergeMode(mode) {
    window.mergeGameMode = mode === "hextech" ? "hextech" : "classic";
    const isHextech = window.mergeGameMode === "hextech";
    if (classicModeBtn) {
      classicModeBtn.classList.toggle("active", !isHextech);
      classicModeBtn.setAttribute("aria-pressed", String(!isHextech));
    }
    if (hextechModeBtn) {
      hextechModeBtn.classList.toggle("active", isHextech);
      hextechModeBtn.setAttribute("aria-pressed", String(isHextech));
    }
    if (mergeModeHint) mergeModeHint.textContent = isHextech
      ? "海克斯模式：合成达到里程碑时，暂停游戏并从 3 个强化中选 1 个；成绩与经典榜分开。"
      : "经典模式：沿用原有规则和全球排行榜。";
  }
  if (classicModeBtn) classicModeBtn.addEventListener("click", () => selectMergeMode("classic"));
  if (hextechModeBtn) hextechModeBtn.addEventListener("click", () => selectMergeMode("hextech"));
  selectMergeMode("classic");

  $("openMergeGameBtn").addEventListener("click", function () {
    if (libraryCover) libraryCover.classList.add("hidden");
    if (developmentView) developmentView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    cover.classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  const openMatchGameBtn = $("openMatchGameBtn");
  if (openMatchGameBtn) openMatchGameBtn.addEventListener("click", function () {
    if (libraryCover) libraryCover.classList.add("hidden");
    cover.classList.add("hidden");
    gameView.classList.add("hidden");
    leaderboardView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (developmentView) developmentView.classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  $("developmentBackBtn").addEventListener("click", function () {
    if (developmentView) developmentView.classList.add("hidden");
    if (libraryCover) libraryCover.classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  $("gameLibraryBackBtn").addEventListener("click", function () {
    cover.classList.add("hidden");
    if (libraryCover) libraryCover.classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  $("coverStartBtn").addEventListener("click", function () {
    if (!saveProfile()) return;
    cover.classList.add("hidden"); leaderboardView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (hextechAverageLeaderboardView) hextechAverageLeaderboardView.classList.add("hidden");
    gameView.classList.remove("hidden");
    $("startBtn").click();
  });
  $("coverCollectionBtn").addEventListener("click", function () {
    cover.classList.add("hidden");
    gameView.classList.add("hidden");
    leaderboardView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (hextechAverageLeaderboardView) hextechAverageLeaderboardView.classList.add("hidden");
    const collectionView = $("collectionView");
    if (collectionView) {
      collectionView.classList.remove("hidden");
      if (typeof window.renderProgress === "function") window.renderProgress();
      window.scrollTo(0, 0);
    }
  });
  $("coverLeaderboardBtn").addEventListener("click", function () {
    cover.classList.add("hidden"); gameView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (hextechAverageLeaderboardView) hextechAverageLeaderboardView.classList.add("hidden");
    leaderboardView.classList.remove("hidden"); loadLeaderboard();
  });
  $("coverHextechLeaderboardBtn").addEventListener("click", function () {
    cover.classList.add("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.add("hidden");
    hextechLeaderboardView.classList.remove("hidden"); loadHextechLeaderboard();
  });
  $("hextechLeaderboardBackBtn").addEventListener("click", backToCover);
  $("hextechLeaderboardRefreshBtn").addEventListener("click", loadHextechLeaderboard);
  const averageBoardButton = $("coverHextechAverageLeaderboardBtn");
  if (averageBoardButton) averageBoardButton.addEventListener("click", function () {
    cover.classList.add("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (hextechAverageLeaderboardView) { hextechAverageLeaderboardView.classList.remove("hidden"); loadHextechAverageLeaderboard(); }
  });
  const averageBoardBackButton = $("hextechAverageLeaderboardBackBtn");
  if (averageBoardBackButton) averageBoardBackButton.addEventListener("click", backToCover);
  const averageBoardRefreshButton = $("hextechAverageLeaderboardRefreshBtn");
  if (averageBoardRefreshButton) averageBoardRefreshButton.addEventListener("click", loadHextechAverageLeaderboard);
  function backToCover() {
    cover.classList.remove("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.add("hidden");
    if (hextechLeaderboardView) hextechLeaderboardView.classList.add("hidden");
    if (hextechAverageLeaderboardView) hextechAverageLeaderboardView.classList.add("hidden");
  }
  $("leaderboardBackBtn").addEventListener("click", backToCover);
  const collectionBackBtn = $("collectionBackBtn");
  if (collectionBackBtn) collectionBackBtn.addEventListener("click", backToCover);
  $("gameBackBtn").addEventListener("click", backToCover);
  $("leaderboardRefreshBtn").addEventListener("click", loadLeaderboard);
  $("leaderboardPrevBtn").addEventListener("click", function () {
    if (rankingPage > 1) { rankingPage--; loadLeaderboardPage(); }
  });
  $("leaderboardNextBtn").addEventListener("click", function () {
    const pageCount = Math.max(1, Math.ceil((rankingMode === "time"
      ? cachedLeaderboardRows.filter(row => row.elapsed_ms !== null && row.elapsed_ms !== undefined && Number.isFinite(Number(row.elapsed_ms)))
      : cachedLeaderboardRows).length / rankingPageSize));
    if (rankingPage < pageCount) { rankingPage++; loadLeaderboardPage(); }
  });
  async function loadLeaderboardPage() {
    const start = (rankingPage - 1) * rankingPageSize;
    const pageRows = cachedLeaderboardRows.slice(start, start + rankingPageSize);
    const missing = pageRows.filter(row => row.id && !Object.prototype.hasOwnProperty.call(row, "avatar"));
    if (missing.length && hasRemote()) {
      try {
        const ids = missing.map(row => row.id).filter(id => Number.isFinite(Number(id)));
        if (ids.length) {
          const avatarRows = await remoteRequest("game_scores?select=id,avatar&id=in.(" + ids.join(",") + ")");
          const avatarById = new Map(avatarRows.map(item => [String(item.id), item.avatar || ""]));
          cachedLeaderboardRows = cachedLeaderboardRows.map(row =>
            avatarById.has(String(row.id)) ? Object.assign({}, row, { avatar: avatarById.get(String(row.id)) }) : row
          );
          writeRankingCache(rankingMode, cachedLeaderboardRows);
        }
      } catch (_) { /* keep scores visible if avatar request fails */ }
    }
    renderRows(cachedLeaderboardRows, rankingMode);
  }
  $("scoreLeaderboardTab").addEventListener("click", function () { setRankingMode("score"); });
  $("timeLeaderboardTab").addEventListener("click", function () { setRankingMode("time"); });
  const adModal = $("adModal");
  function closeAdModal() {
    if (adModal) adModal.classList.add("hidden");
  }
  const closeAdModalBtn = $("closeAdModalBtn");
  const confirmAdModalBtn = $("confirmAdModalBtn");
  if (closeAdModalBtn) closeAdModalBtn.addEventListener("click", closeAdModal);
  if (confirmAdModalBtn) confirmAdModalBtn.addEventListener("click", closeAdModal);
  if (adModal) {
    adModal.querySelectorAll('[data-close-ad="true"]').forEach(el => el.addEventListener("click", closeAdModal));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeAdModal();
    });
  }

  const pendingHextechAtLoad = readHextechPendingScores();
  if (pendingHextechAtLoad.length) syncPendingHextechScores();
  const queuedScoresAtLoad = readPendingScoreQueue();
  if (queuedScoresAtLoad.length) {
    syncPendingScoreQueue().then(result => {
      const status = $("siteProfileStatus") || $("profileHint");
      if (!status) return;
      if (result.ok) status.textContent = "✓ 已自动补传之前未确认的游戏成绩。";
      else status.textContent = "有 " + result.pending + " 条成绩待补传；云端暂时不可用，重新进入游戏或刷新后会再次尝试。";
    });
  }
  const saved = readProfile();
  if (saved.name) nameInput.value = saved.name;
  if (saved.avatar) { avatarData = saved.avatar; avatarPreview.src = avatarData; avatarPreview.hidden = false; avatarFallback.classList.add("hidden"); }
  $("scoreSubmitArea").classList.add("hidden");
})();