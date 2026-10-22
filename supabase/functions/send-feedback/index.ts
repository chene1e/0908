import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigin = "https://chene1e.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const recent = new Map<string, number[]>();
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (origin !== allowedOrigin) return reply({ error: "请求来源不受支持。" }, 403);
  if (req.method !== "POST") return reply({ error: "仅支持提交建议。" }, 405);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FEEDBACK_FROM_EMAIL");
  if (!apiKey || !from) return reply({ error: "邮件服务尚未配置完成，请稍后再试。" }, 503);
  let payload: { message?: unknown; website?: unknown };
  try { payload = await req.json(); } catch { return reply({ error: "提交内容格式不正确。" }, 400); }
  if (typeof payload.website === "string" && payload.website.trim()) return reply({ ok: true });
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (message.length < 3 || message.length > 2000) return reply({ error: "建议内容需为 3 至 2000 个字符。" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const attempts = (recent.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (attempts.length >= 5) return reply({ error: "提交太频繁，请十分钟后再试。" }, 429);
  attempts.push(now); recent.set(ip, attempts);
  const safeText = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: ["2770402600@qq.com"],
      subject: "游戏库新建议 · 我想对策划说点什么",
      text: `收到一条游戏库建议：\n\n${message}\n\n来源：兄弟姐妹全上岸游戏库\n时间：${new Date().toISOString()}`,
      html: `<h2>收到一条游戏库建议</h2><p style="white-space:pre-wrap">${safeText}</p><hr><p>来源：兄弟姐妹全上岸游戏库</p><p>时间：${new Date().toISOString()}</p>`,
    }),
  });
  if (!emailResponse.ok) {
    const detail = await emailResponse.text();
    console.error("Resend send failed", emailResponse.status, detail.slice(0, 300));
    return reply({ error: "邮件暂时没有发送成功，请稍后重试。" }, 502);
  }
  return reply({ ok: true });
});