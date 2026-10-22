(()=>{"use strict";
const $=id=>document.getElementById(id),KEY="workerSim2p5dV1",DAY=86400000;
const shopDefs={coffee:{name:"群友咖啡店",base:8,cost:100,emoji:"☕"},delivery:{name:"群友外卖站",base:18,cost:180,unlock:350,emoji:"🛵"},studio:{name:"群友修 Bug 工作室",base:35,cost:300,unlock:900,emoji:"💻"}};
const staffDefs=[{name:"咖啡阿姨",emoji:"👩🏻‍🍳",skill:"咖啡店效率 +12%",shop:"coffee",bonus:1.12},{name:"闪电骑手",emoji:"🛵",skill:"外卖站效率 +12%",shop:"delivery",bonus:1.12},{name:"摸鱼程序员",emoji:"🧑🏻‍💻",skill:"工作室效率 +15%",shop:"studio",bonus:1.15},{name:"万能群友",emoji:"🧋",skill:"任意店铺效率 +8%",shop:"any",bonus:1.08},{name:"招财猫员工",emoji:"🐱",skill:"咖啡店效率 +10%",shop:"coffee",bonus:1.1}];
const defaultState=()=>({name:"新来的群友",avatar:"🧑🏻‍💼",coins:120,pending:0,lifetime:0,energy:100,shops:{coffee:{unlocked:true,level:1},delivery:{unlocked:false,level:0},studio:{unlocked:false,level:0}},staff:[],autoClaim:true,lastDaily:"",checkins:0,lastSeen:Date.now(),lastTick:Date.now(),dayTasks:{date:"",done:[]},weekly:{start:weekStart(),earned:0,claimed:false},logs:["商业街开张啦！第一家咖啡店正式营业。"]});
function weekStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime()}
function dayKey(t=Date.now()){const d=new Date(t);return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()}
function safeNum(v,f=0){v=Number(v);return Number.isFinite(v)?Math.max(0,v):f}
function load(){try{const old=JSON.parse(localStorage.getItem(KEY)||"null");if(!old)return defaultState();const d=defaultState();const s={...d,...old};s.shops={...d.shops,...old.shops};s.staff=Array.isArray(old.staff)?old.staff:[];s.logs=Array.isArray(old.logs)?old.logs.slice(0,10):d.logs;s.coins=safeNum(s.coins);s.pending=safeNum(s.pending);s.lifetime=safeNum(s.lifetime);s.energy=Math.min(100,safeNum(s.energy,100));s.dayTasks=old.dayTasks||d.dayTasks;s.weekly=old.weekly||d.weekly;return s}catch(e){return defaultState()}}
let s=load(),toastTimer,sceneW=900,sceneH=460,ctx,canvas,raf=0,lastFrame=0,people=[];
function log(t){s.logs.unshift(new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})+" · "+t);s.logs=s.logs.slice(0,8)}
function toast(t){const el=$("toast");el.textContent=t;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2100)}
function save(){s.lastSeen=Date.now();s.lastTick=s.lastSeen;try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}render()}
function currentDay(){if(s.dayTasks.date!==dayKey())s.dayTasks={date:dayKey(),done:[]};if(!s.weekly||Date.now()-s.weekly.start>=7*DAY)s.weekly={start:weekStart(),earned:0,claimed:false}}
function earn(amount,source){amount=Math.max(0,Math.round(amount));s.coins+=amount;s.lifetime+=amount;s.weekly.earned+=amount;if(source==="work")s.dayTasks.done=s.dayTasks.done||[];return amount}
function cost(amount){if(s.coins<amount){toast("金币还不够，再工作一会儿吧！");return false}s.coins-=amount;return true}
function rank(){if(s.lifetime>=15000)return"商业街传奇";if(s.lifetime>=5000)return"群友资本家";if(s.lifetime>=1500)return"小店老板";if(s.lifetime>=500)return"熟练打工人";return"打工新人"}
function staffBonus(shop){return s.staff.reduce((n,e)=>{const d=staffDefs[e.type]||staffDefs[3];return n*(d.shop===shop||d.shop==="any"?d.bonus:1)},1)}
function income(shop){const sh=s.shops[shop];if(!sh||!sh.unlocked)return 0;const wages=s.staff.length*0.7;return Math.max(0,Math.round((shopDefs[shop].base*(1+0.24*(sh.level-1))*staffBonus(shop)-wages/someShopCount())*10)/10)}
function someShopCount(){return Math.max(1,Object.values(s.shops).filter(x=>x.unlocked).length)}
function totalIncome(){return Object.keys(shopDefs).reduce((n,k)=>n+income(k),0)}
function shopCost(k){return Math.round(shopDefs[k].cost*Math.pow(Math.max(1,s.shops[k].level),1.38))}
function addProfit(){const p=totalIncome()/60*5;s.pending+=p;if(s.autoClaim&&p>0){s.coins+=p;s.pending=0}}
function catchUp(){const now=Date.now(),elapsed=Math.max(0,Math.min(8*3600000,now-(s.lastSeen||now)));if(elapsed>60000){const offline=totalIncome()*(elapsed/60000)*0.25;s.pending+=offline;if(s.autoClaim){s.coins+=offline;s.pending=0}if(offline>=1)log("离线经营结算 +"+Math.floor(offline)+" 金币");}const regen=Math.floor(Math.max(0,now-(s.lastTick||now))/30000);if(regen>0)s.energy=Math.min(100,s.energy+regen);s.lastSeen=now;s.lastTick=now;currentDay()}
function render(){currentDay();$("coins").textContent=Math.floor(s.coins).toLocaleString("zh-CN");$("pending").textContent=Math.floor(s.pending).toLocaleString("zh-CN");$("streetLevel").textContent=Math.max(...Object.values(s.shops).filter(x=>x.unlocked).map(x=>x.level),1);$("energy").textContent=Math.floor(s.energy);$("playerRank").textContent=rank();$("playerNameLabel").textContent=s.name||"新来的群友";$("playerAvatar").textContent=s.avatar;
for(const k of Object.keys(shopDefs)){const sh=s.shops[k],el=document.querySelector('[data-shop="'+k+'"]');el.classList.toggle("locked",!sh.unlocked);el.classList.toggle("selected",sh.unlocked);$(k+"Income").textContent=sh.unlocked?"+"+income(k):"—";$(k+"Level").textContent=sh.unlocked?"Lv."+sh.level:"未解锁";if(k!=="coffee"){$(k+"Status").textContent=sh.unlocked?"OPEN":"LOCKED";$(k+"Button").classList.toggle("hidden",sh.unlocked);$(k+"Upgrade").classList.toggle("hidden",!sh.unlocked);$(k+"Button").disabled=s.coins<shopDefs[k].unlock;$(k+"Upgrade").disabled=s.coins<shopCost(k);$(k+"Cost").textContent=shopCost(k)}else{$("coffeeLevel").textContent="Lv."+sh.level;$("coffeeCost").textContent=shopCost(k);document.querySelector('[data-action="upgrade"][data-shop="coffee"]').disabled=s.coins<shopCost(k)}}
$("deliveryLabel").textContent=s.shops.delivery.unlocked?"🛵 群友外卖站":"🛵 外卖站 · 未解锁";$("studioLabel").textContent=s.shops.studio.unlocked?"💻 修 Bug 工作室":"💻 工作室 · 未解锁";$("unlockDelivery").classList.toggle("hidden",s.shops.delivery.unlocked);$("unlockDelivery").disabled=s.coins<350;$("claimBtn").disabled=s.pending<1;$("autoMode").textContent=s.autoClaim?"自动经营 · 自动入账":"自动经营中";$("taskProgress").textContent=s.dayTasks.done.length+"/5 完成";$("checkinBtn").disabled=s.lastDaily===dayKey();$("checkinBtn").textContent=s.lastDaily===dayKey()?"✓ 今日已签到":"签到 +100🪙";$("checkinText").textContent="累计签到 "+s.checkins+" 天 · 不会因漏签清空进度";$("playerName").value=s.name;$("totalEarned").textContent=Math.floor(s.lifetime).toLocaleString("zh-CN");$("shopsOwned").textContent=Object.values(s.shops).filter(x=>x.unlocked).length+"/3";$("staffOwned").textContent=s.staff.length;$("checkinDays").textContent=s.checkins+" 天";$("autoClaim").checked=s.autoClaim;$("weeklyCount").textContent=Math.min(500,Math.floor(s.weekly.earned))+"/500";$("weeklyProgress").style.width=Math.min(100,s.weekly.earned/5)+"%";$("weeklyText").textContent=s.weekly.claimed?"本周目标已完成，继续积累财富！":"本周累计赚取 500 金币，奖励 150 金币";renderStaff();renderTasks();renderSceneNote();updateScene()}
function renderStaff(){const box=$("staffList");box.replaceChildren();$("staffCount").textContent=s.staff.length+" 位员工";if(!s.staff.length){const p=document.createElement("p");p.className="panel-intro";p.textContent="你的店里还缺帮手。招募第一位员工后，店铺净收益会提高，角色也会出现在街道上。";box.append(p)}s.staff.forEach((st,i)=>{const d=staffDefs[st.type]||staffDefs[3],row=document.createElement("div");row.className="staff-card";const av=document.createElement("div");av.className="staff-avatar";av.textContent=d.emoji;const copy=document.createElement("div");copy.className="staff-copy";const b=document.createElement("b");b.textContent=d.name;const small=document.createElement("small");small.textContent=d.skill+" · 工资 0.7金币/分钟";copy.append(b,small);const select=document.createElement("select");select.setAttribute("aria-label","分配"+d.name+"的工作地点");Object.entries(shopDefs).forEach(([k,v])=>{const op=document.createElement("option");op.value=k;op.textContent=v.name;op.disabled=!s.shops[k].unlocked;op.selected=(st.shop||d.shop)==k;if(op.selected&&op.disabled)op.selected=false;select.append(op)});if(![...select.options].some(o=>o.selected&&!o.disabled))select.value="coffee";select.addEventListener("change",()=>{st.shop=select.value;log(d.name+"被分配到"+shopDefs[st.shop].name);save()});row.append(av,copy,select);box.append(row)});$("hireBtn").disabled=s.coins<180;$("hireBtn").textContent="＋ 招募员工 · 180🪙"}
const tasks=[{id:"claim",icon:"💰",title:"老板收钱",desc:"领取一次店铺利润",reward:45,goal:1},{id:"work",icon:"🧰",title:"亲自上阵",desc:"完成 2 次兼职工作",reward:55,goal:2},{id:"upgrade",icon:"🔧",title:"小店焕新",desc:"升级一次店铺或设备",reward:70,goal:1},{id:"hire",icon:"🤝",title:"招兵买马",desc:"招募一位员工",reward:65,goal:1},{id:"earn",icon:"🪙",title:"小有进账",desc:"累计赚取 200 金币",reward:80,goal:200}];
function taskProgress(t){const p=s.dayTasks.progress||{};return Math.min(t.goal,safeNum(p[t.id]))}
function renderTasks(){const box=$("taskList");box.replaceChildren();tasks.forEach(t=>{const done=s.dayTasks.done.includes(t.id),row=document.createElement("div");row.className="task-card"+(done?" done":"");const icon=document.createElement("div");icon.className="task-symbol";icon.textContent=t.icon;const copy=document.createElement("div");copy.className="task-copy";const b=document.createElement("b");b.textContent=t.title;const small=document.createElement("small");small.textContent=t.desc+(t.id==="earn"?"（"+Math.floor(taskProgress(t))+"/"+t.goal+"）":t.id==="work"?"（"+Math.floor(taskProgress(t))+"/"+t.goal+"）":"");copy.append(b,small);const reward=document.createElement("span");reward.className="task-reward";reward.textContent="+"+t.reward+"🪙";const btn=document.createElement("button");btn.textContent=done?"已领取":"领取";btn.disabled=done||taskProgress(t)<t.goal;btn.addEventListener("click",()=>claimTask(t));row.append(icon,copy,reward,btn);box.append(row)})}
function progress(id,n=1){currentDay();s.dayTasks.progress=s.dayTasks.progress||{};s.dayTasks.progress[id]=safeNum(s.dayTasks.progress[id])+n}
function claimTask(t){if(s.dayTasks.done.includes(t.id)||taskProgress(t)<t.goal)return;s.dayTasks.done.push(t.id);earn(t.reward,"task");if(s.dayTasks.done.length===3)earn(80,"milestone");if(s.dayTasks.done.length===5)earn(180,"milestone");log("完成任务「"+t.title+"」 +"+t.reward+"金币");toast(s.dayTasks.done.length===3?"任务奖励到账！已解锁三项里程碑奖励。":s.dayTasks.done.length===5?"五项任务全部完成！额外奖励到账！":"任务奖励 +"+t.reward+"金币");save()}
function unlock(k){const sh=s.shops[k];if(sh.unlocked)return;const c=shopDefs[k].unlock;if(!cost(c))return;sh.unlocked=true;sh.level=1;log("解锁新店铺："+shopDefs[k].name);$("sceneNote").textContent="新店开张！商业街越来越热闹了。";progress("upgrade",0);toast(shopDefs[k].name+"开张啦！");save()}
function upgrade(k){const sh=s.shops[k];if(!sh.unlocked)return;const c=shopCost(k);if(!cost(c))return;sh.level++;progress("upgrade");log(shopDefs[k].name+"升级到 Lv."+sh.level);toast("升级成功！店铺效率提高。");save()}
function work(k){const jobs={coffee:{cost:8,base:25,name:"咖啡兼职"},delivery:{cost:16,base:45,name:"外卖冲刺"},coding:{cost:25,base:70,name:"紧急修 Bug"}};const j=jobs[k];if(s.energy<j.cost){toast("体力不足，休息一会儿再来吧！");return}s.energy-=j.cost;const amount=Math.round(j.base*(1+0.12*(Math.max(...Object.values(s.shops).filter(x=>x.unlocked).map(x=>x.level),1)-1)));earn(amount,"work");progress("work");progress("earn",amount);if(Math.random()<.12){const bonus=15;earn(bonus,"work");$("workStatus").textContent=j.name+"完成！额外拿到惊喜奖金 +"+bonus+"金币。";amount+=bonus}else $("workStatus").textContent=j.name+"完成，收入 +"+amount+" 金币。";log(j.name+"，收入 "+amount+" 金币");save()}
function claim(){if(s.pending<1)return;const n=Math.floor(s.pending);s.coins+=n;s.pending-=n;progress("claim");log("领取店铺利润 +"+n+"金币");toast("利润已到账：+"+n+"金币");save()}
function checkin(){if(s.lastDaily===dayKey())return;s.lastDaily=dayKey();s.checkins++;earn(100+Math.min(100,s.checkins*5),"checkin");log("完成今日签到，获得金币奖励");toast("签到成功！开店基金到账。");save()}
function hire(){if(!cost(180))return;const type=s.staff.length%staffDefs.length;s.staff.push({id:Date.now()+Math.random(),type,shop:staffDefs[type].shop==="any"?"coffee":staffDefs[type].shop});progress("hire");initPeople();log("招募新员工："+staffDefs[type].name);toast(staffDefs[type].name+"加入团队！");save()}
function renderSceneNote(){if(s.shops.studio.unlocked)$("sceneNote").textContent="整条街都开起来啦！生意蒸蒸日上。";else if(s.shops.delivery.unlocked)$("sceneNote").textContent="外卖订单正在路上，下一站：修 Bug 工作室。";else $("sceneNote").textContent="欢迎开张！点击下方店铺卡片，升级或解锁新店。"}
function setupScene(){canvas=$("townCanvas");ctx=canvas.getContext("2d");const resize=()=>{const r=canvas.getBoundingClientRect();const d=Math.min(window.devicePixelRatio||1,2);sceneW=Math.max(320,r.width);sceneH=Math.max(230,r.height);canvas.width=Math.round(sceneW*d);canvas.height=Math.round(sceneH*d);ctx.setTransform(d,0,0,d,0,0);initPeople();drawScene()};if("ResizeObserver"in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener("resize",resize);resize();if(!raf)raf=requestAnimationFrame(animate)}
function initPeople(){people=[];const n=6+s.staff.length*2;for(let i=0;i<n;i++)people.push({x:.12+Math.random()*.76,y:.55+Math.random()*.31,speed:.00006+Math.random()*.00007,phase:Math.random()*6.28,shirt:["#d98b64","#7898b7","#d6b45f","#a5b88c","#b18cb3"][i%5],kind:i<s.staff.length?"staff":"customer",dir:Math.random()<.5?-1:1})}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function isoBuilding(cx,baseY,w,h,colors,emoji,unlocked){
 const left=cx-w/2,top=baseY-h,depth=Math.max(12,w*.12),roofY=top+Math.max(14,h*.11);
 ctx.save();
 ctx.shadowColor="rgba(54,63,50,.16)";ctx.shadowBlur=12;ctx.shadowOffsetY=5;
 poly([[left,roofY],[cx,top],[cx+w/2,roofY],[cx,top+depth]],colors[0]);
 ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 poly([[left,roofY],[cx,top+depth],[cx,baseY],[left,baseY-depth]],colors[1]);
 poly([[cx,top+depth],[cx+w/2,roofY],[cx+w/2,baseY-depth],[cx,baseY]],colors[2]);
 // roof trim
 poly([[left+3,roofY],[cx,top+4],[cx+w/2-3,roofY],[cx,top+depth-4]],colors[4]);
 const winW=w*.105, winH=h*.22;
 for(let i=0;i<2;i++){
   const wx=left+w*(.12+i*.19), wy=top+h*.36;
   poly([[wx,wy+5],[wx+winW*.72,wy],[wx+winW*.72,wy+winH],[wx,wy+winH+5]],"#9bc7cc","#f7f0dc");
   poly([[wx+winW*.36,wy+2],[wx+winW*.36,wy+winH+3]],"#e8e3cf");
 }
 for(let i=0;i<2;i++){
   const wx=cx+w*(.08+i*.17),wy=top+h*.4;
   poly([[wx,wy+4],[wx+winW*.7,wy],[wx+winW*.7,wy+winH],[wx,wy+winH+4]],"#86b7bc","#f5e8cb");
 }
 // awning and shopfront
 poly([[left+3,top+h*.58],[cx,top+h*.48],[cx+w/2-3,top+h*.58],[cx,top+h*.68]],unlocked?"#f7e8c9":"#d2d0ca");
 poly([[left+3,top+h*.58],[cx,top+h*.68],[cx,top+h*.78],[left+3,top+h*.68]],colors[3]);
 poly([[cx,top+h*.68],[cx+w/2-3,top+h*.58],[cx+w/2-3,top+h*.68],[cx,top+h*.78]],colors[0]);
 // front door
 poly([[cx-w*.09,baseY-depth*1.8],[cx,baseY-depth*2.1],[cx,baseY-depth*.15],[cx-w*.09,baseY+depth*.15]],"#8a715c");
 ctx.fillStyle="#f3d7a1";ctx.beginPath();ctx.arc(cx-w*.025,baseY-depth*.95,2,0,Math.PI*2);ctx.fill();
 // hanging sign
 const signY=top+h*.31;
 poly([[cx-w*.02,signY],[cx+w*.2,signY-8],[cx+w*.2,signY+13],[cx-w*.02,signY+21]],unlocked?"#fffaf0":"#e8e7e1","#d5d0c4");
 ctx.font="bold "+Math.max(11,Math.min(19,w*.085))+"px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=unlocked?"#526f5b":"#8b8c87";ctx.fillText(unlocked?emoji:"🔒",cx+w*.09,signY+6);
 if(!unlocked){ctx.fillStyle="rgba(60,65,60,.13)";ctx.fillRect(left,top,w,h)}
 ctx.restore();
}
function tree(x,y,scale=1){
 const s=scale;ctx.save();
 ctx.fillStyle="rgba(67,82,55,.13)";ctx.beginPath();ctx.ellipse(x+5*s,y+8*s,15*s,6*s,0,0,Math.PI*2);ctx.fill();
 rect(x-2*s,y-1*s,5*s,17*s,"#a77b58");
 poly([[x-15*s,y-7*s],[x,y-16*s],[x+15*s,y-7*s],[x,y+2*s]],"#7b9d70");
 poly([[x-12*s,y-15*s],[x,y-27*s],[x+12*s,y-15*s],[x,y-4*s]],"#89ae7b");
 poly([[x-8*s,y-23*s],[x,y-35*s],[x+8*s,y-23*s],[x,y-13*s]],"#a6c394");
 ctx.restore();
}
function person(p,t){const x=p.x*sceneW,y=p.y*sceneH+Math.sin(t/280+p.phase)*2;const size=Math.max(4,sceneW/125);ctx.save();ctx.translate(x,y);ctx.scale(p.dir,1);poly([[-size*.8,0],[0,-size*.45],[size*.8,0],[0,size*.45]],"rgba(48,70,45,.16)");rect(-size*.28,-size*.4,size*.22,size*.48,"#53624d");rect(size*.06,-size*.4,size*.22,size*.48,"#53624d");poly([[-size*.45,-size*1.55],[0,-size*1.8],[size*.45,-size*1.55],[size*.38,-size*.65],[-size*.38,-size*.65]],p.shirt);ctx.beginPath();ctx.arc(0,-size*2,size*.42,0,Math.PI*2);ctx.fillStyle="#efc59c";ctx.fill();ctx.fillStyle="#6b5040";ctx.beginPath();ctx.arc(0,-size*2.12,size*.43,Math.PI,Math.PI*2);ctx.fill();if(p.kind==="staff"){rect(-size*.48,-size*1.45,size*.96,size*.13,"#f4e6c6")}ctx.restore()}
function drawScene(t=performance.now()){
 if(!ctx)return;const w=sceneW,h=sceneH;ctx.clearRect(0,0,w,h);
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#eaf2e5");sky.addColorStop(.56,"#d8e7d1");sky.addColorStop(1,"#c7d7bd");rect(0,0,w,h,"#dce9d2");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // distant soft hills
 poly([[0,h*.35],[w*.18,h*.22],[w*.36,h*.34],[w*.58,h*.2],[w*.82,h*.32],[w,h*.23],[w,h*.58],[0,h*.58]],"#c7d9bd");
 // orderly garden beds
 poly([[0,h*.43],[w*.5,h*.2],[w,h*.43],[w*.5,h*.67]],"#d3e0c6");
 // street pavement
 poly([[0,h*.57],[w*.5,h*.32],[w,h*.57],[w*.5,h*.91]],"#e7dfcc");
 poly([[0,h*.66],[w*.5,h*.42],[w,h*.66],[w*.5,h*.99]],"#f0e8d8");
 // pavement seams
 for(let i=1;i<7;i++){const xx=i*w/7;poly([[xx,h*.66],[xx+2,h*.655],[xx+2,h*.98],[xx,h]],"#d9d0bc")}
 for(let i=0;i<8;i++){const xx=i*w/7;tree(xx+12,h*(.34+(i%2)*.06),.58+(i%3)*.1)}
 // storefront shadows and buildings
 const base=h*.68;
 isoBuilding(w*.2,base,w*.24,h*.37,["#c58c69","#f3d8b9","#d9b092","#b87e5d","#f4dfc5"],"☕",true);
 isoBuilding(w*.5,base-h*.07,w*.23,h*.34,["#9cb8b8","#e5eeea","#bfd5d0","#7fa6a4","#f3eee0"],"🛵",s.shops.delivery.unlocked);
 isoBuilding(w*.8,base-h*.1,w*.24,h*.36,["#b0a4c8","#ece4f0","#c8bddb","#9386b2","#f4edf7"],"⌘",s.shops.studio.unlocked);
 // flower planters and street furniture
 for(let i=0;i<4;i++){const x=w*(.08+i*.27),y=h*(.77+(i%2)*.05);poly([[x-12,y],[x,y-6],[x+12,y],[x,y+6]],"#a6bd8f");rect(x-8,y-2,16,8,"#c18f70");for(let j=0;j<3;j++){ctx.fillStyle=["#d89c92","#e4c77d","#9bbca1"][j];ctx.beginPath();ctx.arc(x-5+j*5,y-7-(j%2)*3,3,0,Math.PI*2);ctx.fill()}}
 // subtle shop labels
 ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.font="600 10px system-ui,sans-serif";ctx.fillStyle="#6b8064";ctx.fillText("群友商业街",w*.5,h*.075);
 ctx.font="10px system-ui,sans-serif";ctx.fillStyle="#7d8c73";ctx.fillText("COFFEE  ·  DELIVERY  ·  STUDIO",w*.5,h*.115);
 for(const p of people)person(p,t);
}
function animate(t){raf=requestAnimationFrame(animate);if(t-lastFrame<70)return;const dt=Math.min(100,t-lastFrame||16);lastFrame=t;for(const p of people){p.x+=p.speed*dt*p.dir;if(p.x>.9){p.x=.9;p.dir=-1}else if(p.x<.08){p.x=.08;p.dir=1}}drawScene(t)}
function updateScene(){if(!ctx)return;drawScene()}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));["business","staff","tasks","profile"].forEach(k=>$("panel-"+k).classList.toggle("hidden",k!==btn.dataset.tab))}));
document.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>btn.dataset.action==="unlock"?unlock(btn.dataset.shop):upgrade(btn.dataset.shop)));$("unlockDelivery").addEventListener("click",()=>unlock("delivery"));
document.querySelectorAll("[data-job]").forEach(btn=>btn.addEventListener("click",()=>work(btn.dataset.job)));
$("claimBtn").addEventListener("click",claim);$("checkinBtn").addEventListener("click",checkin);$("hireBtn").addEventListener("click",hire);$("saveProfile").addEventListener("click",()=>{s.name=$("playerName").value.trim().slice(0,24)||"新来的群友";log("更新玩家昵称："+s.name);save();toast("资料保存成功！")});$("playerName").addEventListener("keydown",e=>{if(e.key==="Enter")$("saveProfile").click()});$("avatarPicker").addEventListener("click",e=>{const b=e.target.closest("button[data-avatar]");if(!b)return;s.avatar=b.dataset.avatar;document.querySelectorAll("[data-avatar]").forEach(x=>x.classList.toggle("picked",x===b));save()});$("autoClaim").addEventListener("change",e=>{s.autoClaim=e.target.checked;if(s.autoClaim&&s.pending>0){s.coins+=s.pending;s.pending=0;log("开启自动入账，待领取利润已转入钱包")}save();toast(s.autoClaim?"已开启自动领取":"已切换为手动领取")});$("resetBtn").addEventListener("click",()=>{if(!confirm("确定重开存档吗？当前商业街进度会被清除，无法撤销。"))return;localStorage.removeItem(KEY);s=defaultState();save();document.querySelector('[data-tab="business"]').click();toast("新的商业街开张啦！")});
function tick(){const now=Date.now(),elapsed=Math.max(0,Math.min(3600000,now-(s.lastTick||now)));if(elapsed>0){const minutes=elapsed/60000;s.energy=Math.min(100,s.energy+minutes*2);const gain=totalIncome()*minutes;s.pending+=gain;if(s.autoClaim){s.coins+=s.pending;s.pending=0}s.lastTick=now;s.lastSeen=now;render();try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}}
catchUp();if(s.dayTasks.date!==dayKey())s.dayTasks={date:dayKey(),done:[],progress:{}};if(!s.dayTasks.progress)s.dayTasks.progress={};setupScene();render();setInterval(tick,5000);window.addEventListener("pagehide",()=>{s.lastSeen=Date.now();try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}});})();
