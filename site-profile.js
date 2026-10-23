(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!window.GameIdentity || !$("sitePlayerName")) return;
  let chosenAvatar = "";
  function paint(profile) {
    $("sitePlayerName").value = profile.name || "";
    $("sitePlayerId").textContent = profile.playerId ? profile.playerId.slice(0, 8) : "首次保存时生成";
    const avatar = chosenAvatar || profile.avatar || "";
    if (avatar) {
      $("siteAvatarPreview").src = avatar;
      $("siteAvatarPreview").hidden = false;
      $("siteAvatarFallback").hidden = true;
    } else {
      $("siteAvatarPreview").hidden = true;
      $("siteAvatarFallback").hidden = false;
    }
    $("siteProfileStatus").textContent = profile.name
      ? "游客资料已载入；昵称、头像和 ID 会由全站游戏共用。"
      : "首次游玩前设置昵称即可；头像可以稍后再上传。";
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) { reject(new Error("请选择图片文件。")); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取图片失败，请重试。"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("图片无法识别，请换一张。"));
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 128 / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("当前浏览器无法处理图片。")); return; }
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let out = canvas.toDataURL("image/jpeg", 0.62);
          if (out.length > 60000) out = canvas.toDataURL("image/jpeg", 0.42);
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  $("sitePlayerId").textContent = "载入中…";
  paint(window.GameIdentity.getProfile());
  $("siteAvatarInput").addEventListener("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    try {
      chosenAvatar = await compress(file);
      paint(Object.assign({}, window.GameIdentity.getProfile(), { avatar: chosenAvatar }));
      $("siteProfileStatus").textContent = "头像已选中，点击“保存全站资料”后生效。";
    } catch (error) {
      $("siteProfileStatus").textContent = error.message || "头像处理失败。";
    }
  });
  function save() {
    const name = $("sitePlayerName").value.trim();
    if (!name) {
      $("siteProfileStatus").textContent = "请先填写一个昵称。";
      $("sitePlayerName").focus();
      return;
    }
    if (name.length > 40) {
      $("siteProfileStatus").textContent = "昵称最多 40 个字符。";
      return;
    }
    const old = window.GameIdentity.getProfile();
    const result = window.GameIdentity.saveProfile({ name: name, avatar: chosenAvatar || old.avatar || "" });
    if (!result.ok) {
      $("siteProfileStatus").textContent = "保存失败：浏览器存储不可用或空间不足。";
      return;
    }
    chosenAvatar = "";
    paint(result.profile);
    $("siteProfileStatus").textContent = "✓ 已保存！全站游戏将共用此昵称、头像和游客 ID。";
  }
  $("saveSiteProfileBtn").addEventListener("click", save);
  $("sitePlayerName").addEventListener("keydown", event => { if (event.key === "Enter") save(); });
})();