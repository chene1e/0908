(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cover = $("cover"), gameView = $("gameView"), leaderboardView = $("leaderboardView");
  const libraryCover = $("libraryCover"), developmentView = $("developmentView");
  const nameInput = $("playerName"), avatarInput = $("avatarInput"), avatarPreview = $("avatarPreview"), avatarFallback = $("avatarFallback");
  const profileHint = $("profileHint"), leaderboardList = $("leaderboardList"), leaderboardStatus = $("leaderboardStatus");
  const config = window.LEADERBOARD_CONFIG || {};
  let avatarData = "";
  let currentScore = null;
  let scoreSubmitted = false;
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
    if (!name) { profileHint.textContent = "先输入一个群昵称吧。"; nameInput.focus(); return false; }
    const saved = readProfile();
    // 未重新选择头像时保留之前保存的头像，避免被空字符串覆盖。
    const avatar = avatarData || saved.avatar || "";
    try { localStorage.setItem("bigGroupProfile", JSON.stringify({ name, avatar })); } catch (_) {
      profileHint.textContent = "资料保存失败，浏览器存储空间可能不足，请换一张更小的头像。";
      return false;
    }
    avatarData = avatar;
    profileHint.textContent = avatar ? "资料和头像已保存！开局冲分吧。" : "昵称已保存。上传头像后，头像才会显示在排行榜。";
    return true;
  }
  function getProfile() {
    const saved = readProfile();
    return { name: nameInput.value.trim() || saved.name || "神秘群友", avatar: avatarData || saved.avatar || "" };
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
    // sb_publishable_* 是新式 publishable key，不是 JWT。
    // 只放在 apikey 请求头，不要把它作为 Bearer token 发送。
    const headers = Object.assign({
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json"
    }, opts.headers || {});
    const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, Object.assign({}, opts, { headers }));
    if (!response.ok) {
      let detail = "";
      try { detail = await response.text(); } catch (_) {}
      throw new Error("HTTP " + response.status + (detail ? ": " + detail.slice(0, 240) : ""));
    }
    if (response.status === 204) return [];
    const text = await response.text();
    return text ? JSON.parse(text) : [];
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
    } catch (_) {
      if (!cached) {
        cachedLeaderboardRows = localScores();
        renderRows(cachedLeaderboardRows, rankingMode);
      }
      leaderboardStatus.textContent = cached
        ? "已显示缓存排行榜；云端更新失败，稍后可刷新。"
        : "⚠ 在线排行榜读取失败，当前显示本机记录（不代表全球榜）。请检查网络后刷新。";
    }
  }
  window.finishAndOfferScore = function (score, elapsedMs, wonRound) {
    currentScore = Number(score) || 0;
    currentElapsedMs = elapsedMs !== null && elapsedMs !== undefined && Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : null;
    currentRoundWon = wonRound === true && currentElapsedMs !== null;
    scoreSubmitted = false;
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
    const row = { name: profile.name, avatar: profile.avatar, score: currentScore, elapsed_ms: currentRoundWon ? currentElapsedMs : null, created_at: new Date().toISOString() };
    this.disabled = true; this.textContent = "提交中…";
    storeLocalScore(row);
    try {
      if (hasRemote()) {
        await remoteRequest("game_scores", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
        $("submitScoreHint").textContent = "成绩已提交到全球排行榜！";
      } else {
        $("submitScoreHint").textContent = "成绩已保存在本机。要让所有人共享，还需完成一次在线数据库配置。";
      }
      scoreSubmitted = true; this.textContent = "已提交";
    } catch (submitError) {
      // 网络/响应解析可能在数据库已经写入后才失败；先核对云端，避免误报失败。
      try {
        if (hasRemote()) {
          const from = new Date(Date.now() - 120000).toISOString();
          const verifyPath = "game_scores?select=id,name,score,created_at"
            + "&name=eq." + encodeURIComponent(profile.name)
            + "&score=eq." + encodeURIComponent(String(currentScore))
            + "&created_at=gte." + encodeURIComponent(from)
            + "&order=created_at.desc&limit=10";
          const matches = await remoteRequest(verifyPath);
          const confirmed = Array.isArray(matches) && matches.some(item =>
            item.name === profile.name && Number(item.score) === Number(currentScore)
          );
          if (confirmed) {
            $("submitScoreHint").textContent = "成绩已成功写入全球排行榜！页面刚才未收到正常确认，现已核实云端记录。";
            scoreSubmitted = true; this.disabled = true; this.textContent = "已提交";
            return;
          }
        }
      } catch (_) {}
      const detail = submitError && submitError.message ? submitError.message : "未知错误";
      $("submitScoreHint").textContent = "云端上传失败：" + detail.slice(0, 180) + "。成绩已保存在本机，请检查网络后重试。";
      this.disabled = false; this.textContent = "重新申请上传";
    }
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
  $("openMergeGameBtn").addEventListener("click", function () {
    if (libraryCover) libraryCover.classList.add("hidden");
    if (developmentView) developmentView.classList.add("hidden");
    cover.classList.remove("hidden");
    window.scrollTo(0, 0);
  });
  $("openMatchGameBtn").addEventListener("click", function () {
    if (libraryCover) libraryCover.classList.add("hidden");
    cover.classList.add("hidden");
    gameView.classList.add("hidden");
    leaderboardView.classList.add("hidden");
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
    cover.classList.add("hidden"); leaderboardView.classList.add("hidden"); gameView.classList.remove("hidden");
    $("startBtn").click();
  });
  $("coverCollectionBtn").addEventListener("click", function () {
    cover.classList.add("hidden");
    gameView.classList.add("hidden");
    leaderboardView.classList.add("hidden");
    const collectionView = $("collectionView");
    if (collectionView) {
      collectionView.classList.remove("hidden");
      if (typeof window.renderProgress === "function") window.renderProgress();
      window.scrollTo(0, 0);
    }
  });
  $("coverLeaderboardBtn").addEventListener("click", function () {
    cover.classList.add("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.remove("hidden"); loadLeaderboard();
  });
  function backToCover() { cover.classList.remove("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.add("hidden"); }
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

  const saved = readProfile();
  if (saved.name) nameInput.value = saved.name;
  if (saved.avatar) { avatarData = saved.avatar; avatarPreview.src = avatarData; avatarPreview.hidden = false; avatarFallback.classList.add("hidden"); }
  $("scoreSubmitArea").classList.add("hidden");
})();