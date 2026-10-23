(function () {
"use strict";
const $ = id => document.getElementById(id);
const config = window.LEADERBOARD_CONFIG || {};
const PENDING_KEY = "catchFriendsPendingUploadsV1";
const W = 480, H = 640, BASKET_Y = 570, BASKET_W = 112;
const AVATARS = Array.from({ length: 9 }, (_, i) => ({ level: i + 1, name: "群友 " + (i + 1), src: "assets/level" + (i + 1) + ".png" }));
const images = AVATARS.map(item => { const img = new Image(); img.src = item.src; return img; });
const canvas = $("playfield"), ctx = canvas.getContext("2d");
let selected = 1, screen = "cover", running = false, raf = 0, lastFrame = 0, startAt = 0, elapsed = 0, spawnClock = 0;
let basketX = W / 2, objects = [], floaters = [], score = 0, lives = 3, caught = 0, missed = 0, combo = 0, maxCombo = 0;
let roundId = "", finishReason = "lives", finalRow = null, uploadInProgress = false, pendingUploads = loadPendingUploads();
function uid() { return window.GameIdentity ? window.GameIdentity.newId() : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
function getProfile() {
  if (window.GameIdentity) return window.GameIdentity.getProfile();
  let p = {}; try { p = JSON.parse(localStorage.getItem("bigGroupProfile") || "{}"); } catch (_) {}
  if (!p.playerId) { p.playerId = uid(); try { localStorage.setItem("bigGroupProfile", JSON.stringify(p)); } catch (_) {} }
  return { playerId: p.playerId, name: p.name || "", avatar: p.avatar || "" };
}
function saveProfile(patch) {
  if (window.GameIdentity) return window.GameIdentity.saveProfile(patch);
  const p = Object.assign({}, getProfile(), patch || {}); try { localStorage.setItem("bigGroupProfile", JSON.stringify(p)); return { ok: true }; } catch (_) { return { ok: false }; }
}
function hasCloud() { return !!(config.supabaseUrl && config.supabaseAnonKey); }
async function api(path, options) {
  const opts = options || {};
  const method = String(opts.method || "GET").toUpperCase();
  const maxAttempts = method === "GET" ? 3 : 1;
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
        const error = new Error("HTTP " + response.status + (detail ? " · " + detail.slice(0, 160) : ""));
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) return [];
      const body = await response.text();
      return body ? JSON.parse(body) : [];
    } catch (error) {
      lastError = error;
      const retryable = method === "GET" && attempt < maxAttempts - 1
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

function bestKey(playerId) { return "catchFriendsBestV1:" + playerId; }
function readBest(playerId) { try { return Math.max(0, Number(localStorage.getItem(bestKey(playerId))) || 0); } catch (_) { return 0; } }
function profileUI() {
  const p = getProfile();
  $("profileName").textContent = p.name || "尚未设置昵称";
  $("profileId").textContent = p.playerId ? "游客 ID · " + p.playerId.slice(0, 8) : "";
  if (p.avatar) { $("profileAvatar").src = p.avatar; $("profileAvatar").hidden = false; $("profileFallback").hidden = true; }
  else { $("profileAvatar").hidden = true; $("profileFallback").hidden = false; }
}
function picker() {
  const root = $("targetPicker"); root.replaceChildren();
  AVATARS.forEach(item => {
    const button = document.createElement("button"); button.type = "button"; button.className = "target-option" + (item.level === selected ? " selected" : "");
    button.setAttribute("aria-pressed", String(item.level === selected));
    const img = document.createElement("img"); img.src = item.src; img.alt = item.name;
    const name = document.createElement("span"); name.textContent = item.name;
    const note = document.createElement("small"); note.textContent = item.level === selected ? "★ 本局心仪目标" : "选择目标";
    button.append(img, name, note);
    button.addEventListener("click", () => { selected = item.level; picker(); $("targetAvatar").src = item.src; $("targetName").textContent = item.name; $("targetHint").textContent = "已选择 " + item.name + "。接中 +15 分，金色奖励头像 +30 分。"; });
    root.append(button);
  });
  $("targetAvatar").src = AVATARS[selected - 1].src; $("targetName").textContent = AVATARS[selected - 1].name;
}
function showOnly(which) {
  screen = which;
  $("cover").classList.toggle("hidden", which !== "cover");
  $("gameScreen").classList.toggle("hidden", which !== "game");
  $("rankingScreen").classList.toggle("hidden", which !== "ranking");
  window.scrollTo(0, 0);
}
function toast(text) {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 1200);
}
function setLives() {
  $("lives").textContent = "♥ ".repeat(Math.max(0, lives)).trim() + (lives < 3 ? " ♡".repeat(3 - lives) : "");
  $("lives").setAttribute("aria-label", "剩余 " + lives + " 滴血");
}
function difficulty() {
  const t = elapsed;
  return {
    interval: t < 10 ? 0.90 : t < 22 ? 0.68 : t < 38 ? 0.49 : 0.34,
    max: t < 10 ? 3 : t < 22 ? 5 : t < 38 ? 7 : 9,
    speed: 118 + Math.min(245, t * 4.0)
  };
}
function spawn() {
  const d = difficulty(), levelRoll = Math.random();
  let level;
  if (levelRoll < 0.34) level = selected;
  else { level = 1 + Math.floor(Math.random() * 8); if (level >= selected) level++; }
  const bonus = Math.random() < 0.12;
  const radius = 23 + Math.random() * 3;
  const speed = d.speed * (0.83 + Math.random() * 0.36);
  objects.push({ level, bonus, x: radius + Math.random() * (W - radius * 2), y: -radius, r: radius, speed, vx: (Math.random() - 0.5) * 38, caught: false });
}
function startRound() {
  const p = getProfile();
  if (!p.name) { $("coverStatus").textContent = "请先到游戏库首页设置昵称，再开始游戏。"; return; }
  score = 0; lives = 3; caught = 0; missed = 0; combo = 0; maxCombo = 0; elapsed = 0; spawnClock = 0;
  basketX = W / 2; objects = []; floaters = []; roundId = uid(); finalRow = null; finishReason = "lives";
  $("score").textContent = "0"; $("survivalTime").textContent = "0:00"; $("bestScore").textContent = readBest(p.playerId).toLocaleString(); $("bestBadge").textContent = ""; setLives();
  $("comboLabel").textContent = "连击 ×0"; $("resultOverlay").classList.add("hidden"); $("retryUploadButton").classList.add("hidden");
  showOnly("game"); running = true; startAt = performance.now(); lastFrame = startAt; raf = requestAnimationFrame(frame);
}
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.045, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; elapsed = Math.max(0, (now - startAt) / 1000);
  const d = difficulty(); spawnClock += dt;
  while (spawnClock >= d.interval && objects.length < d.max) { spawnClock -= d.interval; spawn(); }
  if (objects.length >= d.max) spawnClock = Math.min(spawnClock, d.interval);
  update(dt); draw();
  $("survivalTime").textContent = formatClock(elapsed);
  if (!running) return;
  raf = requestAnimationFrame(frame);
}
function update(dt) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i]; o.x += o.vx * dt; o.y += o.speed * dt;
    if (o.x < o.r || o.x > W - o.r) o.vx *= -1;
    if (o.y + o.r >= BASKET_Y && o.y - o.r <= BASKET_Y + 15) {
      if (Math.abs(o.x - basketX) <= BASKET_W / 2 + o.r * 0.45) {
        catchObject(o); objects.splice(i, 1); continue;
      }
    }
    if (o.y - o.r > BASKET_Y + 20) {
      objects.splice(i, 1); missObject();
      if (!running) return;
    }
  }
  for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].y -= 28 * dt; floaters[i].life -= dt; if (floaters[i].life <= 0) floaters.splice(i, 1); }
}
function catchObject(o) {
  caught++; combo++; maxCombo = Math.max(maxCombo, combo);
  let gain = o.bonus ? 30 : 10;
  if (o.level === selected) gain += 5;
  if (combo > 0 && combo % 5 === 0) gain += 10;
  score += gain; $("score").textContent = score.toLocaleString(); $("comboLabel").textContent = "连击 ×" + combo;
  floaters.push({ x: o.x, y: o.y, text: "+" + gain + (o.bonus ? " ✨" : ""), life: 0.9, color: o.bonus ? "#9a6100" : o.level === selected ? "#087e88" : "#24304d" });
  if (o.bonus) toast("✨ 金色奖励！ +" + gain);
  else if (o.level === selected) toast("🎯 接到心仪群友！ +" + gain);
  else if (combo % 5 === 0) toast("🔥 连续接中 " + combo + " 次！奖励已到账");
}
function missObject() {
  missed++; lives = Math.max(0, lives - 1); combo = 0; setLives(); $("comboLabel").textContent = "连击 ×0";
  toast("漏接了！生命 -1");
  if (lives <= 0) finish("lives");
}
function roundTime(ms) { return (Math.max(0, ms) / 1000).toFixed(1) + " 秒"; }
function formatClock(seconds) { const total = Math.floor(Math.max(0, seconds)); return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0"); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit" }); }
function localRows() { try { const value = JSON.parse(localStorage.getItem("catchFriendsScoresV1") || "[]"); return Array.isArray(value) ? value : []; } catch (_) { return []; } }

function loadPendingUploads() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(value) ? value.filter(row => row && row.round_id && row.player_id) : [];
  } catch (_) { return []; }
}
function persistPendingUploads() {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingUploads.slice(-100))); } catch (_) {}
}
function queueUpload(row) {
  if (!pendingUploads.some(item => item.round_id === row.round_id)) pendingUploads.push(row);
  persistPendingUploads();
}
async function recoverLocalCatchScores() {
  const cached = localRows().filter(row => row && row.round_id && row.player_id).slice(0, 25);
  if (hasCloud() && cached.length) {
    try {
      const ids = Array.from(new Set(cached.map(row => row.round_id))).filter(id => /^[0-9a-f-]{36}$/i.test(id));
      if (ids.length) {
        const existing = await api("catch_scores?select=round_id&round_id=in.(" + ids.join(",") + ")");
        const known = new Set((Array.isArray(existing) ? existing : []).map(row => row.round_id));
        cached.filter(row => !known.has(row.round_id)).forEach(queueUpload);
      }
    } catch (_) {
      // If the cloud lookup fails, keep the old local cache untouched and only retry queued rows.
    }
  }
  if (hasCloud() && pendingUploads.length) {
    $("coverStatus").textContent = "检测到 " + pendingUploads.length + " 局待确认成绩，正在自动核对并补传…";
    await saveRun(pendingUploads[0]);
  }
}
function storeLocal(row) { const rows = localRows(); rows.unshift(row); try { localStorage.setItem("catchFriendsScoresV1", JSON.stringify(rows.slice(0, 25))); } catch (_) {} }
function finish(reason) {
  if (!running) return;
  running = false; cancelAnimationFrame(raf); finishReason = reason;
  const p = getProfile(); const duration = Math.max(0, elapsed);
  const oldBest = readBest(p.playerId);
  const isRecord = score > oldBest;
  const newBest = Math.max(oldBest, score);
  try { localStorage.setItem(bestKey(p.playerId), String(newBest)); } catch (_) {}
  $("bestScore").textContent = newBest.toLocaleString();
  $("finalBest").textContent = newBest.toLocaleString();
  $("bestBadge").textContent = isRecord ? "新纪录！" : "";
  finalRow = {
    round_id: roundId, player_id: p.playerId, name: (p.name || "神秘群友").slice(0, 40), avatar: p.avatar || "",
    target_level: selected, score, caught_count: caught, missed_count: missed, max_combo: maxCombo,
    survival_seconds: Number(duration.toFixed(2)), finish_reason: reason, created_at: new Date().toISOString()
  };
  storeLocal(finalRow); queueUpload(finalRow);
  $("resultTitle").textContent = isRecord ? "🏆 刷新个人纪录！" : "❤️ 生命耗尽";
  $("finalScore").textContent = score.toLocaleString(); $("finalCaught").textContent = String(caught);
  $("finalMissed").textContent = String(missed); $("finalCombo").textContent = String(maxCombo); $("finalDuration").textContent = roundTime(duration * 1000);
  $("finishTimestamp").textContent = "完成时间：" + formatDate(finalRow.created_at) + " · 心仪群友：" + AVATARS[selected - 1].name;
  $("uploadStatus").textContent = "正在上传本局成绩…"; $("resultOverlay").classList.remove("hidden");
  saveRun(finalRow);
}
async function saveRun(requestedRow) {
  if (uploadInProgress) return;
  const row = requestedRow || pendingUploads[0] || finalRow;
  if (!row) return;
  uploadInProgress = true;
  $("retryUploadButton").classList.add("hidden");
  if (!hasCloud()) {
    if (finalRow) {
      $("uploadStatus").textContent = "云端排行榜配置不可用；已保留本机记录，联网后可以重试。";
      $("retryUploadButton").classList.remove("hidden");
    } else {
      $("coverStatus").textContent = "有 " + pendingUploads.length + " 局成绩等待上传；当前无法连接云端。";
    }
    uploadInProgress = false;
    return;
  }
  let uploaded = false;
  try {
    await api("catch_scores", { method:"POST", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({
      round_id:row.round_id, player_id:row.player_id, name:row.name, avatar:row.avatar, target_level:row.target_level,
      score:row.score, caught_count:row.caught_count, missed_count:row.missed_count, max_combo:row.max_combo,
      survival_seconds:row.survival_seconds, finish_reason:row.finish_reason
    }) });
    uploaded = true;
  } catch (error) {
    try {
      const rows = await api("catch_scores?select=round_id&round_id=eq." + encodeURIComponent(row.round_id) + "&limit=1");
      uploaded = Array.isArray(rows) && rows.some(item => item.round_id === row.round_id);
    } catch (_) {}
    if (!uploaded) {
      const detail = error && error.message ? error.message : "网络或数据库请求失败";
      if (finalRow) {
        $("uploadStatus").textContent = "上传未确认（" + detail.slice(0, 110) + "）；本机已保留 " + pendingUploads.length + " 局待上传记录。请重试。";
        $("retryUploadButton").classList.remove("hidden");
      } else {
        $("coverStatus").textContent = "检测到待上传成绩，但自动补传失败；记录仍保存在本机。请检查网络后重新打开游戏。";
      }
    }
  }
  if (uploaded) {
    pendingUploads = pendingUploads.filter(item => item.round_id !== row.round_id);
    persistPendingUploads();
    if (finalRow && finalRow.round_id === row.round_id) {
      $("uploadStatus").textContent = "✓ 已上传全球排行榜 · 本局成绩已记录";
      $("retryUploadButton").classList.add("hidden");
    }
  }
  uploadInProgress = false;
  if (uploaded && pendingUploads.length && !running) saveRun(pendingUploads[0]);
}
function drawBackground() {
  const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#bdeaff"); g.addColorStop(.68,"#effaff"); g.addColorStop(1,"#d7f0d6");
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ffffffb8";
  [[55,64,31],[83,56,23],[105,67,30],[345,102,28],[372,92,23],[396,105,30]].forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()});
  ctx.fillStyle="#9bd7c3";ctx.beginPath();ctx.moveTo(0,390);ctx.quadraticCurveTo(95,330,175,390);ctx.quadraticCurveTo(280,330,385,385);ctx.quadraticCurveTo(430,355,480,380);ctx.lineTo(480,H);ctx.lineTo(0,H);ctx.fill();
  ctx.fillStyle="#75c79d";ctx.fillRect(0,530,W,110);
  ctx.fillStyle="#5daf83";for(let x=10;x<W;x+=28){ctx.fillRect(x,535,3,8);ctx.fillRect(x+9,548,2,5)}
}
function roundedAvatar(o) {
  ctx.save();
  if(o.bonus){ctx.beginPath();ctx.arc(o.x,o.y,o.r+7,0,Math.PI*2);ctx.fillStyle="#ffd16699";ctx.fill();ctx.strokeStyle="#fff0a6";ctx.lineWidth=3;ctx.stroke()}
  else if(o.level===selected){ctx.beginPath();ctx.arc(o.x,o.y,o.r+4,0,Math.PI*2);ctx.strokeStyle="#20bfc5";ctx.lineWidth=3;ctx.stroke()}
  ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.clip();
  const img=images[o.level-1];
  if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,o.x-o.r,o.y-o.r,o.r*2,o.r*2);
  else {ctx.fillStyle="#e9e7df";ctx.fillRect(o.x-o.r,o.y-o.r,o.r*2,o.r*2);ctx.fillStyle="#4b5563";ctx.font="bold 22px sans-serif";ctx.textAlign="center";ctx.fillText(String(o.level),o.x,o.y+8)}
  ctx.restore();
}
function drawBasket() {
  const x=basketX,y=BASKET_Y+4,w=BASKET_W,h=38;
  ctx.save();ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x-w*.39,y+h);ctx.quadraticCurveTo(x,y+h+9,x+w*.39,y+h);ctx.lineTo(x+w/2,y);ctx.closePath();
  const g=ctx.createLinearGradient(x-w/2,y,x+w/2,y+h);g.addColorStop(0,"#f6ba68");g.addColorStop(.5,"#c67a37");g.addColorStop(1,"#8c4c2b");ctx.fillStyle=g;ctx.fill();ctx.strokeStyle="#7c4029";ctx.lineWidth=4;ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y,w/2,10,0,0,Math.PI*2);ctx.fillStyle="#a95d31";ctx.fill();ctx.strokeStyle="#ffe0a4";ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle="#f8d69a";ctx.lineWidth=2;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x+i*16,y+4);ctx.lineTo(x+i*12,y+h-2);ctx.stroke()}
  ctx.restore();
}
function draw() {
  drawBackground(); objects.forEach(roundedAvatar); drawBasket();
  ctx.textAlign="center";ctx.font="bold 13px system-ui";floaters.forEach(f=>{ctx.globalAlpha=Math.max(0,Math.min(1,f.life));ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);});ctx.globalAlpha=1;
  if(running&&elapsed>0){ctx.fillStyle="#ffffffbd";ctx.font="bold 12px system-ui";ctx.textAlign="left";ctx.fillText("速度 ×"+(1+elapsed/30).toFixed(1),13,22);ctx.textAlign="right";ctx.fillText("同时掉落 "+difficulty().max+" 个以内",W-13,22)}
}
function moveBasket(clientX) {
  const rect=canvas.getBoundingClientRect();
  if(!rect.width)return;
  basketX=Math.max(BASKET_W/2+5,Math.min(W-BASKET_W/2-5,(clientX-rect.left)*W/rect.width));
}
canvas.addEventListener("pointermove",event=>{if(running){moveBasket(event.clientX);if(event.pointerType!=="mouse")event.preventDefault()}});
canvas.addEventListener("pointerdown",event=>{if(running){moveBasket(event.clientX);if(event.pointerType!=="mouse")event.preventDefault()}});
document.addEventListener("keydown",event=>{
  if(!running)return;
  const key=event.key.toLowerCase();
  if(["arrowleft","arrowright","a","d"].includes(key)){event.preventDefault();const step=key==="arrowleft"||key==="a"?-34:34;basketX=Math.max(BASKET_W/2+5,Math.min(W-BASKET_W/2-5,basketX+step))}
});
$("startButton").addEventListener("click",startRound);
$("rankingButton").addEventListener("click",()=>{showOnly("ranking");loadRanking()});
$("resultRankingButton").addEventListener("click",()=>{showOnly("ranking");loadRanking()});
$("rankingBackButton").addEventListener("click",()=>showOnly("cover"));
$("gameBackButton").addEventListener("click",()=>{if(running){if(!window.confirm("退出将放弃本局成绩，确定退出吗？"))return;running=false;cancelAnimationFrame(raf);showOnly("cover");return}showOnly("cover")});
$("againButton").addEventListener("click",startRound);
$("resultCoverButton").addEventListener("click",()=>showOnly("cover"));
$("retryUploadButton").addEventListener("click",()=>saveRun());
$("refreshRankingButton").addEventListener("click",loadRanking);
async function loadRanking() {
  $("rankingStatus").textContent="正在读取全球排行榜…"; const list=$("rankingList");list.replaceChildren();
  let rows=[], cloud=false;
  if(hasCloud()) {
    try { rows=(await api("catch_scores?select=player_id,name,avatar,score,target_level,caught_count,missed_count,max_combo,survival_seconds,finish_reason,created_at&order=score.desc,created_at.asc&limit=20")).slice(0,20);cloud=true; }
    catch(error){$("rankingStatus").textContent="云端暂时无法连接，下面显示本机最近成绩："+String(error.message||"").slice(0,80)}
  }
  if(!cloud) rows=localRows().slice().sort((a,b)=>Number(b.score)-Number(a.score)||String(a.created_at).localeCompare(String(b.created_at))).slice(0,20);
  if(cloud)$("rankingStatus").textContent="全球排行榜 · 最多显示前 20 条成绩；时间为本局完成时间。";
  if(!rows.length){const li=document.createElement("li");li.className="empty-rank";li.textContent="还没有成绩，快来成为第一位登榜的群友！";list.append(li);return}
  rows.forEach((row,index)=>{
    const li=document.createElement("li");li.className="ranking-row";
    const rank=document.createElement("span");rank.className="rank-number";rank.textContent=index<3?["🥇","🥈","🥉"][index]:String(index+1);
    const img=document.createElement("img");img.className="rank-avatar";img.alt="";img.loading="lazy";img.src=row.avatar||"";
    if(!row.avatar){img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='#34405f'/><text x='32' y='43' font-size='34' text-anchor='middle'>👤</text></svg>")}
    img.onerror=function(){this.onerror=null;this.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='#34405f'/><text x='32' y='43' font-size='34' text-anchor='middle'>👤</text></svg>")};
    const who=document.createElement("div");who.className="rank-player";
    const name=document.createElement("strong");name.textContent=row.name||"神秘群友";
    const meta=document.createElement("small");meta.textContent="目标：群友 "+Number(row.target_level||1)+" · 游玩："+formatDate(row.created_at)+" · 存活 "+roundTime(Number(row.survival_seconds)*1000)+" · 接住 "+Number(row.caught_count||0)+" 个";
    who.append(name,meta);
    const metric=document.createElement("span");metric.className="rank-metric";metric.textContent=Number(row.score||0).toLocaleString()+" 分";
    li.append(rank,img,who,metric);list.append(li);
  });
}
function init() {
  profileUI(); picker(); draw();
  const p=getProfile();
  $("coverStatus").textContent=p.name?"已使用全站游客身份，成绩将关联同一个玩家 ID。":"先在游戏库首页设置昵称，所有游戏会共用这份资料。";
  $("targetHint").textContent="接住 "+AVATARS[selected-1].name+" 可得 15 分；金色奖励头像可得 30 分。";
  recoverLocalCatchScores();
}
init();
})();