(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const cover = $("cover"), gameView = $("gameView"), leaderboardView = $("leaderboardView");
  const nameInput = $("playerName"), avatarInput = $("avatarInput"), avatarPreview = $("avatarPreview"), avatarFallback = $("avatarFallback");
  const profileHint = $("profileHint"), leaderboardList = $("leaderboardList"), leaderboardStatus = $("leaderboardStatus");
  const config = window.LEADERBOARD_CONFIG || {};
  let avatarData = "";
  let currentScore = null;
  let scoreSubmitted = false;

  function readProfile() {
    try { return JSON.parse(localStorage.getItem("bigGroupProfile") || "{}"); } catch (_) { return {}; }
  }
  function saveProfile() {
    const name = nameInput.value.trim();
    if (!name) { profileHint.textContent = "先输入一个群昵称吧。"; nameInput.focus(); return false; }
    try { localStorage.setItem("bigGroupProfile", JSON.stringify({ name, avatar: avatarData })); } catch (_) {}
    profileHint.textContent = "资料已保存！开局冲分吧。";
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
  function renderRows(rows) {
    leaderboardList.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li");
      li.className = "empty-ranking";
      li.textContent = "还没有成绩，快来成为第一位上榜的群友！";
      leaderboardList.appendChild(li);
      return;
    }
    rows.slice().sort((a,b) => Number(b.score)-Number(a.score)).slice(0,100).forEach((row,index) => {
      const li = document.createElement("li");
      const rank = document.createElement("span"); rank.className = "rank-number"; rank.textContent = index < 3 ? ["🥇","🥈","🥉"][index] : String(index+1);
      const img = document.createElement("img"); img.className = "rank-avatar"; img.alt = ""; img.src = row.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23f3eadc'/%3E%3Ctext x='50%25' y='58%25' font-size='42' text-anchor='middle'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
      const info = document.createElement("div"); info.className = "rank-info";
      const name = document.createElement("div"); name.className = "rank-name"; name.textContent = row.name || "神秘群友";
      const time = document.createElement("div"); time.className = "rank-time"; time.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : "本机记录";
      info.append(name,time);
      const score = document.createElement("span"); score.className = "rank-score"; score.textContent = Number(row.score) + "分";
      li.append(rank,img,info,score); leaderboardList.appendChild(li);
    });
  }
  async function loadLeaderboard() {
    leaderboardStatus.textContent = "正在读取排行榜…";
    try {
      if (hasRemote()) {
        const rows = await remoteRequest("game_scores?select=name,avatar,score,created_at&order=score.desc,created_at.desc&limit=100");
        renderRows(rows);
        leaderboardStatus.textContent = "在线全球榜 · 每局成绩独立记录";
      } else {
        renderRows(localScores());
        leaderboardStatus.textContent = "当前为本机预览榜；配置在线数据库后，所有人才能共享成绩。";
      }
    } catch (_) {
      renderRows(localScores());
      leaderboardStatus.textContent = "在线榜暂时无法连接，以下显示本机记录。";
    }
  }
  window.finishAndOfferScore = function (score) {
    currentScore = Number(score) || 0;
    scoreSubmitted = false;
    $("submitScoreHint").textContent = "本局得分：" + currentScore + "。点击提交，将成绩加入排行榜。";
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
    const row = { name: profile.name, avatar: profile.avatar, score: currentScore, created_at: new Date().toISOString() };
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
    } catch (_) {
      $("submitScoreHint").textContent = "在线提交失败，成绩已保存在本机，请稍后重试。";
      this.disabled = false; this.textContent = "重试提交";
    }
  });
  avatarInput.addEventListener("change", function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { profileHint.textContent = "请选择图片文件。"; return; }
    if (file.size > 1500000) { profileHint.textContent = "头像请控制在 1.5MB 以内。"; this.value = ""; return; }
    const reader = new FileReader();
    reader.onload = function () { avatarData = reader.result; avatarPreview.src = avatarData; avatarPreview.hidden = false; avatarFallback.classList.add("hidden"); profileHint.textContent = "头像已选好，记得保存资料。"; };
    reader.readAsDataURL(file);
  });
  $("saveProfileBtn").addEventListener("click", saveProfile);
  $("coverStartBtn").addEventListener("click", function () {
    if (!saveProfile()) return;
    cover.classList.add("hidden"); leaderboardView.classList.add("hidden"); gameView.classList.remove("hidden");
    $("startBtn").click();
  });
  $("coverLeaderboardBtn").addEventListener("click", function () {
    cover.classList.add("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.remove("hidden"); loadLeaderboard();
  });
  function backToCover() { cover.classList.remove("hidden"); gameView.classList.add("hidden"); leaderboardView.classList.add("hidden"); }
  $("leaderboardBackBtn").addEventListener("click", backToCover);
  $("gameBackBtn").addEventListener("click", backToCover);
  $("leaderboardRefreshBtn").addEventListener("click", loadLeaderboard);
  const saved = readProfile();
  if (saved.name) nameInput.value = saved.name;
  if (saved.avatar) { avatarData = saved.avatar; avatarPreview.src = avatarData; avatarPreview.hidden = false; avatarFallback.classList.add("hidden"); }
  $("scoreSubmitArea").classList.add("hidden");
})();