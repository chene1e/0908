(function(){
  "use strict";
  const modal=document.getElementById("feedbackModal");
  const openBtn=document.getElementById("openFeedbackBtn");
  const closeBtn=document.getElementById("closeFeedbackBtn");
  const form=document.getElementById("feedbackForm");
  const message=document.getElementById("feedbackMessage");
  const status=document.getElementById("feedbackStatus");
  const submit=document.getElementById("sendFeedbackBtn");
  const endpoint="https://owqerwkisyjiiskmecoc.supabase.co/functions/v1/send-feedback";
  function close(){modal.classList.add("hidden");}
  openBtn.addEventListener("click",()=>{modal.classList.remove("hidden");status.textContent="";status.className="feedback-status";message.focus();});
  closeBtn.addEventListener("click",close);
  modal.querySelectorAll('[data-close-feedback="true"]').forEach(el=>el.addEventListener("click",close));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.classList.contains("hidden"))close();});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const text=message.value.trim();
    if(text.length<3){status.textContent="请再多写一点建议内容。";status.className="feedback-status error";message.focus();return;}
    if(text.length>2000){status.textContent="建议内容不能超过 2000 字。";status.className="feedback-status error";return;}
    submit.disabled=true;submit.textContent="提交中…";status.textContent="正在发送，请稍候…";status.className="feedback-status";
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,website:form.elements.website.value}),signal:controller.signal});
      let data={};try{data=await response.json();}catch(_){}
      if(!response.ok)throw new Error(data.error||"提交失败，请稍后重试。");
      form.reset();status.textContent="感谢你的建议！已经成功发送给策划。";status.className="feedback-status success";
    }catch(err){status.textContent=err.name==="AbortError"?"发送超时，请检查网络后重试。":(err.message||"发送失败，请稍后重试。");status.className="feedback-status error";}
    finally{clearTimeout(timer);submit.disabled=false;submit.textContent="提交建议";}
  });
})();