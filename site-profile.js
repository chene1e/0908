(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!window.GameIdentity || !$("sitePlayerName")) return;
  function paint(profile) {
    $("sitePlayerName").value = profile.name || "";
    $("sitePlayerId").textContent = profile.playerId ? profile.playerId.slice(0, 8) : "首次保存时生成";
    const avatar = profile.avatar || "";
    if (avatar) {
      $("siteAvatarPreview").src = avatar;
      $("siteAvatarPreview").hidden = false;
      $("siteAvatarFallback").hidden = true;
    } else {
      $("siteAvatarPreview").removeAttribute("src");
      $("siteAvatarPreview").hidden = true;
      $("siteAvatarFallback").hidden = false;
    }
    $("siteProfileStatus").textContent = profile.name
      ? "游客资料已载入；点击头像即可更换，全站游戏共用同一头像。"
      : "首次游玩前设置昵称即可；点击头像可以随时添加或更换头像。";
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject(new Error("请选择图片文件。"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取图片失败，请重试。"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("图片无法识别，请换一张。"));
        img.onload = () => {
          try {
            const side = 192;
            const sourceSide = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = Math.max(0, (img.naturalWidth - sourceSide) / 2);
            const sy = Math.max(0, (img.naturalHeight - sourceSide) / 2);
            const canvas = document.createElement("canvas");
            canvas.width = side;
            canvas.height = side;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("当前浏览器无法处理图片。");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, side, side);
            ctx.drawImage(img, sx, sy, sourceSide, sourceSide, 0, 0, side, side);
            let out = canvas.toDataURL("image/jpeg", 0.72);
            if (out.length > 60000) out = canvas.toDataURL("image/jpeg", 0.52);
            if (out.length > 60000) {
              canvas.width = 128;
              canvas.height = 128;
              const small = canvas.getContext("2d");
              if (!small) throw new Error("当前浏览器无法处理图片。");
              small.fillStyle = "#ffffff";
              small.fillRect(0, 0, 128, 128);
              small.drawImage(img, sx, sy, sourceSide, sourceSide, 0, 0, 128, 128);
              out = canvas.toDataURL("image/jpeg", 0.45);
            }
            resolve(out);
          } catch (error) {
            reject(error);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $("sitePlayerId").textContent = "载入中…";
  paint(window.GameIdentity.getProfile());

  $("siteAvatarButton").addEventListener("click", () => {
    $("siteAvatarInput").click();
  });

  $("siteAvatarInput").addEventListener("change", async function () {
    const input = this;
    const file = input.files && input.files[0];
    if (!file) return;
    const previousProfile = window.GameIdentity.getProfile();
    $("siteAvatarButton").disabled = true;
    $("siteProfileStatus").textContent = "正在处理头像并保存…";
    try {
      const avatar = await compress(file);
      const result = window.GameIdentity.saveProfile({ avatar });
      if (!result.ok) {
        paint(previousProfile);
        $("siteProfileStatus").textContent = "保存失败：浏览器存储空间可能不足，原头像保持不变。";
        return;
      }
      paint(result.profile);
      $("siteProfileStatus").textContent = "✓ 头像已自动保存！所有游戏将共用新头像，昵称和游客 ID 不变。";
    } catch (error) {
      paint(previousProfile);
      $("siteProfileStatus").textContent = error && error.message ? error.message : "头像处理失败，原头像保持不变。";
    } finally {
      $("siteAvatarButton").disabled = false;
      input.value = "";
    }
  });

  function saveName() {
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
    const result = window.GameIdentity.saveProfile({ name });
    if (!result.ok) {
      $("siteProfileStatus").textContent = "保存失败：浏览器存储不可用或空间不足。";
      return;
    }
    paint(result.profile);
    $("siteProfileStatus").textContent = "✓ 昵称已保存！头像和游客 ID 保持不变。";
  }
  $("saveSiteProfileBtn").addEventListener("click", saveName);
  $("sitePlayerName").addEventListener("keydown", event => {
    if (event.key === "Enter") saveName();
  });
})();