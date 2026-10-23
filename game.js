"use strict";

// =============================================
// 照片合成大挑战
// 9个等级，合成第9级获胜
// =============================================

const {
    Engine,
    Render,
    Runner,
    Bodies,
    Body,
    Composite,
    Events
} = Matter;


// =============================================
// 一、游戏参数
// =============================================

// 游戏区域实际尺寸
const GAME_WIDTH = 480;
const GAME_HEIGHT = 680;

// 游戏物理边界厚度
const WALL_THICKNESS = 40;

// 总共9个等级
const LEVEL_COUNT = 9;

// 每个等级对应的圆形半径
const RADII = [
    20,
    27,
    35,
    44,
    54,
    66,
    80,
    96,
    116
];

// 合成后获得的分数
const LEVEL_SCORES = [
    1, 2, 4, 8, 16, 32, 64, 128, 256
];
const HEXTECH_MILESTONES = [4, 12, 22];
const HEXTECH_AUGMENTS = [
 // 银色：稳定收益、宽松操作与前期成长
 {id:"cashBack",tier:"silver",tierName:"银色强化",name:"合成返现",description:"每次合成额外获得 18 分。",note:"稳定收益"},
 {id:"luckyFaces",tier:"silver",tierName:"银色强化",name:"欧皇基因",description:"闪光群友出现概率提高 8 个百分点。",note:"更多稀有群友"},
 {id:"steadyHands",tier:"silver",tierName:"银色强化",name:"连击热手",description:"连击判定时间延长至 7 秒。",note:"更宽松的连击窗口"},
 {id:"speedyHands",tier:"silver",tierName:"银色强化",name:"极速投放",description:"缩短投放间隔，让操作更流畅。",note:"更快投放"},
 {id:"mergeScholar",tier:"silver",tierName:"银色强化",name:"合成学徒",description:"每次合成额外获得 8 分，可与其他加分效果叠加。",note:"稳定小额收益"},
 {id:"rareWhisper",tier:"silver",tierName:"银色强化",name:"稀有耳语",description:"闪光群友出现概率额外提高 4 个百分点。",note:"偏向稀有收集"},
 {id:"smallSteps",tier:"silver",tierName:"银色强化",name:"小步快跑",description:"合成等级 1–3 的群友时，得分提高 50%。",note:"前期成长流"},
 {id:"comboRhythm",tier:"silver",tierName:"银色强化",name:"连击节拍",description:"连击倍率提高至 ×1.75。",note:"连击流入门"},
 {id:"streakPurse",tier:"silver",tierName:"银色强化",name:"五连红包",description:"每完成第 5、10、15…次合成，额外获得 60 分。",note:"合成里程碑奖励"},
 {id:"firstAid",tier:"silver",tierName:"银色强化",name:"备用护身符",description:"本局获得一次濒临失败时的保护。",note:"容错一次"},
 {id:"clearSilver",tier:"silver",tierName:"银色强化",name:"消除按钮",description:"获得一次消除机会：点击按钮后，全场所有 Level 3 群友消失。",note:"一次性清除 Level 3"},
 // 金色：中期构筑、连击与高等级收益
 {id:"bigMerge",tier:"gold",tierName:"金色强化",name:"高能合成",description:"所有合成基础得分提高 50%。",note:"每次合成都受益"},
 {id:"comboEngine",tier:"gold",tierName:"金色强化",name:"连击引擎",description:"从 2 连击开始获得倍率，倍率提高到 ×2。",note:"奖励连续合成"},
 {id:"eventMachine",tier:"gold",tierName:"金色强化",name:"事件加速器",description:"随机事件出现得更频繁。",note:"更多惊喜事件"},
 {id:"safetyNet",tier:"gold",tierName:"金色强化",name:"救场护盾",description:"本局第一次濒临失败时，自动化险为夷。",note:"一次保护机会"},
 {id:"highRoller",tier:"gold",tierName:"金色强化",name:"闪光收藏家",description:"闪光群友的合成奖励提高到 ×4。",note:"稀有收益流"},
 {id:"veteranCraft",tier:"gold",tierName:"金色强化",name:"资深手艺",description:"合成等级 5 及以上的群友时，得分提高 35%。",note:"高等级合成流"},
 {id:"hotStreak",tier:"gold",tierName:"金色强化",name:"三连红包",description:"每完成第 3、6、9…次合成，额外获得 80 分。",note:"节奏越稳收益越高"},
 {id:"chainDividend",tier:"gold",tierName:"金色强化",name:"连击分红",description:"进入连击状态后，每次连击合成额外获得 25 分。",note:"鼓励持续连击"},
 {id:"goldenTouch",tier:"gold",tierName:"金色强化",name:"点石成金",description:"所有合成得分额外提高 25%。",note:"泛用增伤"},
 {id:"luckyTempo",tier:"gold",tierName:"金色强化",name:"好运节拍",description:"连击判定时间延长至 6.5 秒，连击倍率提高至 ×1.8。",note:"稳定连击流"},
 {id:"clearGold",tier:"gold",tierName:"金色强化",name:"消除按钮",description:"获得一次消除机会：点击按钮后，全场所有 Level 2、Level 3 群友消失。",note:"一次性清除 Level 2–3"},
 // 棱彩：强力流派与高上限组合
 {id:"smallMerge",tier:"prismatic",tierName:"棱彩强化",name:"小球大计",description:"合成等级 1–3 的群友时，获得双倍分数。",note:"低级合成流派"},
 {id:"prismaticLuck",tier:"prismatic",tierName:"棱彩强化",name:"棱彩欧皇",description:"闪光群友更常出现，稀有合成奖励提高到 ×5。",note:"高风险高收益"},
 {id:"tripleBurst",tier:"prismatic",tierName:"棱彩强化",name:"三倍爆发",description:"接下来 3 次合成得分变为三倍。",note:"抓住爆发窗口"},
 {id:"compoundInterest",tier:"prismatic",tierName:"棱彩强化",name:"复利核心",description:"每完成第 5、10、15…次合成，额外获得 120 分。",note:"越合越赚"},
 {id:"kingmaker",tier:"prismatic",tierName:"棱彩强化",name:"高阶王权",description:"合成等级 6 及以上的群友时，得分提高 60%。",note:"冲击高等级"},
 {id:"limitBreak",tier:"prismatic",tierName:"棱彩强化",name:"极限突破",description:"所有合成得分额外提高 75%。",note:"高上限泛用流"},
 {id:"comboOverdrive",tier:"prismatic",tierName:"棱彩强化",name:"连击超载",description:"从 2 连击开始触发倍率，连击倍率提高至 ×2.5。",note:"连击核心流派"},
 {id:"jackpotEngine",tier:"prismatic",tierName:"棱彩强化",name:"欧皇引擎",description:"闪光群友概率额外提高 12 个百分点，闪光奖励提高到 ×4。",note:"稀有爆发流"},
 {id:"everyThree",tier:"prismatic",tierName:"棱彩强化",name:"三步登天",description:"每完成第 3、6、9…次合成，额外获得 100 分。",note:"快速合成流"},
 {id:"goldRush",tier:"prismatic",tierName:"棱彩强化",name:"黄金洪流",description:"每次合成额外获得 35 分，并且每第 10 次合成再获得 250 分。",note:"持续收益与爆发"},
 {id:"clearPrismatic",tier:"prismatic",tierName:"棱彩强化",name:"消除按钮",description:"获得一次消除机会：点击按钮后，全场所有 Level 1、Level 2、Level 3 群友消失。",note:"一次性清除 Level 1–3"}
];

// 顶部投放区域的高度
const DROP_LINE_Y = 90;

// 游戏结束判定等待时间
const GAME_OVER_DELAY = 1500;


// =============================================
// 二、获取网页元素
// =============================================

const gameContainer =
    document.getElementById("game-container");

const scoreElement =
    document.getElementById("score");

const bestScoreElement =
    document.getElementById("bestScore");

const nextCanvas =
    document.getElementById("nextCanvas");

const nextCtx =
    nextCanvas.getContext("2d");

const startBtn =
    document.getElementById("startBtn");

const pauseBtn =
    document.getElementById("pauseBtn");

const restartBtn =
    document.getElementById("restartBtn");

const stopBtnBottom =
    document.getElementById("stopBtnBottom");

const message =
    document.getElementById("message");

const messageTitle =
    document.getElementById("message-title");

const messageText =
    document.getElementById("message-text");

const messageRestart =
    document.getElementById("message-restart");
const hextechOverlay = document.getElementById("hextechOverlay");
const hextechChoices = document.getElementById("hextechChoices");
const hextechOfferHint = document.getElementById("hextechOfferHint");
const hextechRunStatus = document.getElementById("hextechRunStatus");
const hextechProgressTitle = document.getElementById("hextechProgressTitle");
const hextechProgressHint = document.getElementById("hextechProgressHint");
const hextechOwnedList = document.getElementById("hextechOwnedList");
const hextechOwnedInfo = document.getElementById("hextechOwnedInfo");
const hextechAbilityButtons = document.getElementById("hextechAbilityButtons");
const hextechAugmentCount = document.getElementById("hextechAugmentCount");
const hextechScoreStatus = document.getElementById("hextechScoreStatus");
const scoreSubmitArea = document.getElementById("scoreSubmitArea");
if (hextechAugmentCount) hextechAugmentCount.textContent = String(HEXTECH_AUGMENTS.length);


// =============================================
// 三、读取9张图片
// =============================================

const images = [];

for (let i = 1; i <= LEVEL_COUNT; i++) {

    const img = new Image();

    // 例如 assets/level1.png
    img.src = `assets/level${i}.png`;

    images.push(img);

}


// =============================================
// 四、游戏状态
// =============================================

let engine = null;
let render = null;
let runner = null;

let score = 0;
let bestScore = 0;

let nextLevel = 1;

let started = false;
let paused = false;
let gameOver = false;
let won = false;

let pointerX = GAME_WIDTH / 2;

let canDrop = true;

let lastDropTime = 0;

let gameOverTimer = 0;
let gameStartedAt = 0;
let level9ElapsedMs = null;
let level9Celebrated = false;

// 正在合成的圆形ID
const mergingBodies = new Set();

// 待处理的合成事件
let mergeQueue = [];

// 趣味玩法：连击、随机事件、稀有群友与图鉴
let comboCount = 0;
let lastMergeAt = 0;
let eventMultiplierUntil = 0;
let nextMergeBonus = false;
let nextEventAt = 0;
let roundDrops = 0;
let roundMerges = 0;
let roundRare = 0;
let hextechModeActive = false, hextechOwned = [], hextechOffersTaken = 0, hextechOfferedAugments = [];
let hextechClearUsed = new Set();
let hextechScoreMultiplier = 1, hextechBonusPerMerge = 0, hextechRareChanceBonus = 0;
let hextechRareScoreMultiplier = 3, hextechComboWindowMs = 4500, hextechComboThreshold = 3, hextechComboMultiplier = 1.5;
let hextechDropCooldownMs = 250, hextechDropRecoveryMs = 450, hextechEventFrequencyMultiplier = 1;
let hextechShieldCharges = 0, hextechSmallMergeMultiplier = 1, hextechTripleMergesRemaining = 0, hextechEveryFiveMergesBonus = 0;
let hextechHighLevelMultiplier = 1, hextechEveryThreeMergesBonus = 0, hextechEveryTenMergesBonus = 0, hextechComboFlatBonus = 0;
let hextechScoreSubmitted = false;
const PROGRESS_KEY = "bigGroupProgressV1";
const DAILY_KEY = "bigGroupDailyV1";
const LEVEL_NAMES = ["初来乍到","活跃群友","气氛担当","梗王候选","群聊明星","资深群友","传奇群友","群聊传说","合成之神"];
let progressData = loadProgress();
let dailyData = loadDaily();



// =============================================
// 五、读取最高分
// =============================================

try {

    bestScore =
        Number(
            localStorage.getItem("mergeBestScore")
        ) || 0;

} catch (error) {

    bestScore = 0;

}

bestScoreElement.textContent = bestScore;
renderProgress();


// =============================================
// 趣味系统：本地保存的图鉴、每日任务、随机事件
// =============================================
function loadProgress() {
    try {
        const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
        return {
            levels: Array.isArray(data.levels) ? data.levels : [],
            rares: Array.isArray(data.rares) ? data.rares : [],
            achievements: Array.isArray(data.achievements) ? data.achievements : [],
            totalMerges: Number(data.totalMerges) || 0,
            totalDrops: Number(data.totalDrops) || 0
        };
    } catch (_) { return { levels: [], rares: [], achievements: [], totalMerges: 0, totalDrops: 0 }; }
}
function loadDaily() {
    const today = new Date().toLocaleDateString("sv-SE");
    try {
        const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
        return saved.date === today ? saved : { date: today, drops: 0, merges: 0, rares: 0, games: 0 };
    } catch (_) { return { date: today, drops: 0, merges: 0, rares: 0, games: 0 }; }
}
function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressData)); } catch (_) {}
}
function saveDaily() {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyData)); } catch (_) {}
}
function discoverLevel(level) {
    if (!progressData.levels.includes(level)) {
        progressData.levels.push(level);
        progressData.levels.sort((a,b) => a-b);
        saveProgress();
        showToast("📖 图鉴解锁：" + LEVEL_NAMES[level - 1]);
        checkAchievements();
    }
    renderProgress();
}
function discoverRare(level) {
    const key = String(level);
    if (!progressData.rares.includes(key)) {
        progressData.rares.push(key);
        saveProgress();
    }
    dailyData.rares = (dailyData.rares || 0) + 1;
    saveDaily();
    renderProgress();
}
function updateDailyProgress() {
    dailyData.merges = (dailyData.merges || 0) + 1;
    progressData.totalMerges = (progressData.totalMerges || 0) + 1;
    saveDaily();
    checkAchievements();
}
function checkAchievements() {
    const achievements = [
        ...Array.from({ length: LEVEL_COUNT }, (_, index) => {
            const level = index + 1;
            return ["level-" + level, progressData.levels.includes(level), LEVEL_NAMES[index]];
        })
    ];
    achievements.forEach(([id, condition, title]) => {
        if (condition && !progressData.achievements.includes(id)) {
            progressData.achievements.push(id);
            showToast("🏅 成就解锁：" + title);
        }
    });
    saveProgress();
}
function updateProgressUI() { checkAchievements(); renderProgress(); }
function renderProgress() {
    const collectionCount = document.getElementById("collectionCount");
    const summary = document.getElementById("collectionPageSummary");
    const collectionGrid = document.getElementById("collectionGrid");
    if (collectionCount) collectionCount.textContent = progressData.levels.length + "/9";
    if (summary) summary.textContent = "已合成 " + progressData.levels.length + "/9 张群友图片 · 每解锁一张，就获得一个对应成就。";
    if (collectionGrid) {
        collectionGrid.innerHTML = "";
        for (let level = 1; level <= LEVEL_COUNT; level++) {
            const unlocked = progressData.levels.includes(level);
            const card = document.createElement("div");
            card.className = "collection-item collection-card" + (unlocked ? " unlocked" : " locked");
            const img = document.createElement("img");
            img.className = "collection-avatar";
            img.alt = unlocked ? LEVEL_NAMES[level - 1] : "未解锁群友";
            img.src = unlocked ? "assets/level" + level + ".png" : "";
            if (!unlocked) img.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#eee7db"/><text x="50" y="61" text-anchor="middle" font-size="42" fill="#b7a993">?</text></svg>');
            const title = document.createElement("strong");
            title.textContent = unlocked ? LEVEL_NAMES[level - 1] : "？？？";
            const status = document.createElement("small");
            status.textContent = unlocked ? "🏅 成就已解锁" : "🔒 合成后解锁";
            card.append(img, title, status);
            collectionGrid.appendChild(card);
        }
    }
}
let toastTimer = null;
function showToast(text) {
    const toast = document.getElementById("gameToast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("toast-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("toast-show"), 2100);
}
function renderHextechStatus() {
    if (!hextechRunStatus) return;
    hextechRunStatus.classList.toggle("hidden", !hextechModeActive);
    if (!hextechModeActive) return;
    if (hextechProgressTitle) hextechProgressTitle.textContent = "⚡ 海克斯模式 · 已选 " + hextechOffersTaken + "/3";
    if (hextechProgressHint) {
        if (hextechOffersTaken >= HEXTECH_MILESTONES.length) hextechProgressHint.textContent = "本局强化已集齐，继续合成冲击高分。";
        else {
            const left = Math.max(0, HEXTECH_MILESTONES[hextechOffersTaken] - roundMerges);
            hextechProgressHint.textContent = left === 0 ? "海克斯强化已就绪！" : "再合成 " + left + " 次，即可选择第 " + (hextechOffersTaken + 1) + " 枚强化。";
        }
    }
    if (hextechAbilityButtons) {
        hextechAbilityButtons.replaceChildren();
        const clearAbilities = [
            {id:"clearSilver", label:"消除按钮 · 银", levels:[3], tier:"silver"},
            {id:"clearGold", label:"消除按钮 · 金", levels:[2,3], tier:"gold"},
            {id:"clearPrismatic", label:"消除按钮 · 棱彩", levels:[1,2,3], tier:"prismatic"}
        ];
        clearAbilities.filter(ability => hextechOwned.some(item => item.id === ability.id)).forEach(ability => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "hextech-ability-button tier-" + ability.tier;
            const used = hextechClearUsed.has(ability.id);
            button.textContent = used ? ability.label + "（已使用）" : ability.label + "（清除 Lv." + ability.levels.join("、") + "）";
            button.disabled = used || !started || paused || gameOver;
            button.setAttribute("aria-label", used ? ability.label + "已使用" : ability.label + "，清除等级 " + ability.levels.join("、"));
            button.addEventListener("click", () => useHextechClearAbility(ability));
            hextechAbilityButtons.appendChild(button);
        });
    }
    if (hextechOwnedList) {
        hextechOwnedList.replaceChildren();
        hextechOwned.forEach(a => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "hextech-owned-chip";
            chip.textContent = a.name;
            chip.title = a.description;
            chip.dataset.tooltip = a.description;
            chip.setAttribute("aria-expanded", String(Boolean(hextechOwnedInfo && !hextechOwnedInfo.classList.contains("hidden") && hextechOwnedInfo.dataset.augmentId === a.id)));
            chip.addEventListener("click", () => {
                if (!hextechOwnedInfo) return;
                const alreadyOpen = !hextechOwnedInfo.classList.contains("hidden") && hextechOwnedInfo.dataset.augmentId === a.id;
                if (alreadyOpen) {
                    hextechOwnedInfo.classList.add("hidden");
                    hextechOwnedInfo.textContent = "";
                    delete hextechOwnedInfo.dataset.augmentId;
                } else {
                    hextechOwnedInfo.textContent = a.tierName + " · " + a.name + "：" + a.description;
                    hextechOwnedInfo.dataset.augmentId = a.id;
                    hextechOwnedInfo.classList.remove("hidden");
                }
                hextechOwnedList.querySelectorAll("button.hextech-owned-chip").forEach(button => {
                    button.setAttribute("aria-expanded", String(button === chip && !alreadyOpen));
                });
            });
            hextechOwnedList.appendChild(chip);
        });
    }
}
function useHextechClearAbility(ability) {
    if (!hextechModeActive || !started || paused || gameOver || !ability || hextechClearUsed.has(ability.id) || !hextechOwned.some(item => item.id === ability.id) || !engine) return;
    hextechClearUsed.add(ability.id);
    const levels = new Set(ability.levels);
    const targets = Composite.allBodies(engine.world).filter(body => !body.isStatic && levels.has(Number(body.level)));
    targets.forEach(body => {
        mergingBodies.delete(body.id);
        Composite.remove(engine.world, body);
    });
    renderHextechStatus();
    showToast("🧹 " + ability.label + "已发动，清除了 " + targets.length + " 个群友。");
}

function applyHextechAugment(a) {
    switch (a.id) {
        case "cashBack": hextechBonusPerMerge += 18; break;
        case "luckyFaces": hextechRareChanceBonus += 0.08; break;
        case "steadyHands": hextechComboWindowMs = Math.max(hextechComboWindowMs, 7000); break;
        case "speedyHands": hextechDropCooldownMs = Math.min(hextechDropCooldownMs, 180); hextechDropRecoveryMs = Math.min(hextechDropRecoveryMs, 320); break;
        case "mergeScholar": hextechBonusPerMerge += 8; break;
        case "rareWhisper": hextechRareChanceBonus += 0.04; break;
        case "smallSteps": hextechSmallMergeMultiplier = Math.max(hextechSmallMergeMultiplier, 1.5); break;
        case "comboRhythm": hextechComboMultiplier = Math.max(hextechComboMultiplier, 1.75); break;
        case "streakPurse": hextechEveryFiveMergesBonus += 60; break;
        case "firstAid": hextechShieldCharges += 1; break;
        case "clearSilver": case "clearGold": case "clearPrismatic": break;
        case "bigMerge": hextechScoreMultiplier += 0.5; break;
        case "comboEngine": hextechComboThreshold = 2; hextechComboMultiplier = Math.max(hextechComboMultiplier, 2); break;
        case "eventMachine": hextechEventFrequencyMultiplier = Math.min(hextechEventFrequencyMultiplier, 0.72); break;
        case "safetyNet": hextechShieldCharges += 1; break;
        case "highRoller": hextechRareScoreMultiplier = Math.max(hextechRareScoreMultiplier, 4); break;
        case "veteranCraft": hextechHighLevelMultiplier = Math.max(hextechHighLevelMultiplier, 1.35); break;
        case "hotStreak": hextechEveryThreeMergesBonus += 80; break;
        case "chainDividend": hextechComboFlatBonus += 25; break;
        case "goldenTouch": hextechScoreMultiplier += 0.25; break;
        case "luckyTempo": hextechComboWindowMs = Math.max(hextechComboWindowMs, 6500); hextechComboMultiplier = Math.max(hextechComboMultiplier, 1.8); break;
        case "smallMerge": hextechSmallMergeMultiplier = Math.max(hextechSmallMergeMultiplier, 2); break;
        case "prismaticLuck": hextechRareChanceBonus += 0.18; hextechRareScoreMultiplier = Math.max(hextechRareScoreMultiplier, 5); break;
        case "tripleBurst": hextechTripleMergesRemaining += 3; break;
        case "compoundInterest": hextechEveryFiveMergesBonus += 120; break;
        case "kingmaker": hextechHighLevelMultiplier = Math.max(hextechHighLevelMultiplier, 1.6); break;
        case "limitBreak": hextechScoreMultiplier += 0.75; break;
        case "comboOverdrive": hextechComboThreshold = 2; hextechComboMultiplier = Math.max(hextechComboMultiplier, 2.5); break;
        case "jackpotEngine": hextechRareChanceBonus += 0.12; hextechRareScoreMultiplier = Math.max(hextechRareScoreMultiplier, 4); break;
        case "everyThree": hextechEveryThreeMergesBonus += 100; break;
        case "goldRush": hextechBonusPerMerge += 35; hextechEveryTenMergesBonus += 250; break;
    }
}
function chooseHextechAugment(a) {
    if (!hextechModeActive || !a || hextechOffersTaken >= 3 || hextechOwned.some(item => item.id === a.id)) return;
    hextechOwned.push(a); applyHextechAugment(a); hextechOffersTaken++;
    if (hextechOverlay) hextechOverlay.classList.add("hidden");
    renderHextechStatus(); showToast("⚡ 海克斯生效：" + a.name);
    if (offerHextechIfDue()) return;
    paused = false;
    if (runner && engine && started && !gameOver) Runner.run(runner, engine);
}
function offerHextechIfDue() {
    if (!hextechModeActive || !started || gameOver || hextechOffersTaken >= 3 || roundMerges < HEXTECH_MILESTONES[hextechOffersTaken]) return false;
    if (!hextechOverlay || !hextechChoices) return false;
    paused = true; gameOverTimer = 0; if (runner) Runner.stop(runner);
    hextechChoices.replaceChildren();
    if (hextechOfferHint) hextechOfferHint.textContent = "第 " + (hextechOffersTaken + 1) + " 次强化 · " + ["银色","金色","棱彩"][hextechOffersTaken] + "品质 · 已合成 " + roundMerges + " 次。同一轮只出现同品质强化，效果持续到本局结束。";
    const tierForOffer = ["silver", "gold", "prismatic"][hextechOffersTaken];
    const pool = HEXTECH_AUGMENTS.filter(a => a.tier === tierForOffer && !hextechOwned.some(item => item.id === a.id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const offered = pool.slice(0, 3);
    const recordOfferedAugment = augment => {
        if (!augment) return;
        hextechOfferedAugments.push({id:augment.id, tier:augment.tier, tierName:augment.tierName, name:augment.name});
    };
    const renderChoice = (card, augment) => {
        card.replaceChildren();
        const tier = document.createElement("span"); tier.className = "hextech-tier"; tier.textContent = augment.tierName;
        const name = document.createElement("strong"); name.textContent = augment.name;
        const description = document.createElement("p"); description.textContent = augment.description;
        const note = document.createElement("small"); note.textContent = augment.note;
        card.append(tier, name, description, note);
        card.setAttribute("aria-label", augment.name + "：" + augment.description + "，点击选择");
    };
    offered.forEach((initialAugment, index) => {
        let currentAugment = initialAugment;
        recordOfferedAugment(currentAugment);
        let refreshed = false;
        const wrap = document.createElement("div"); wrap.className = "hextech-choice-wrap";
        const card = document.createElement("button"); card.type = "button"; card.className = "hextech-card tier-" + initialAugment.tier;
        renderChoice(card, currentAugment);
        card.addEventListener("click", () => chooseHextechAugment(currentAugment));
        const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "hextech-refresh-btn";
        refresh.textContent = "↻ 刷新（剩余 1 次）";
        refresh.setAttribute("aria-label", "刷新第 " + (index + 1) + " 个海克斯选项");
        refresh.addEventListener("click", () => {
            if (refreshed) return;
            const candidates = HEXTECH_AUGMENTS.filter(a =>
                a.tier === tierForOffer &&
                !hextechOwned.some(item => item.id === a.id) &&
                !offered.some((item, offeredIndex) => offeredIndex !== index && item.id === a.id) &&
                a.id !== currentAugment.id
            );
            if (!candidates.length) {
                refresh.disabled = true;
                refresh.textContent = "暂无可刷新选项";
                return;
            }
            currentAugment = candidates[Math.floor(Math.random() * candidates.length)];
            offered[index] = currentAugment;
            recordOfferedAugment(currentAugment);
            refreshed = true;
            renderChoice(card, currentAugment);
            refresh.disabled = true;
            refresh.textContent = "✓ 已刷新";
            refresh.setAttribute("aria-label", "此海克斯选项已使用刷新机会");
        });
        wrap.append(card, refresh);
        hextechChoices.appendChild(wrap);
    });
    hextechOverlay.classList.remove("hidden");
    const first = hextechChoices.querySelector("button"); if (first) first.focus();
    return true;
}

function getHextechHighestLevel() {
    if (!engine) return 1;
    return Composite.allBodies(engine.world)
        .filter(body => body.label === "photoBall")
        .reduce((highest, body) => Math.max(highest, Number(body.level) || 1), 1);
}
function submitHextechRunScore() {
    if (!hextechModeActive || hextechScoreSubmitted) return;
    hextechScoreSubmitted = true;
    if (hextechScoreStatus) {
        hextechScoreStatus.classList.remove("hidden");
        hextechScoreStatus.textContent = "正在保存本局海克斯成绩…";
    }
    const payload = {
        score,
        merge_count: roundMerges,
        highest_level: getHextechHighestLevel(),
        augments: hextechOwned.map(a => ({
            id:a.id, tier:a.tier, tierName:a.tierName,
            name:a.name, description:a.description
        })),
        offered_augments: hextechOfferedAugments.slice(0,60)
    };
    if (typeof window.submitHextechScore !== "function") {
        if (hextechScoreStatus) hextechScoreStatus.textContent = "本局已结束，但成绩上传模块暂不可用；请刷新后再试。";
        return;
    }
    Promise.resolve(window.submitHextechScore(payload)).then(result => {
        if (!hextechScoreStatus) return;
        if (result && result.ok) {
            hextechScoreStatus.textContent = "✓ 已保存并同步到海克斯全球排行榜！";
        } else if (result && result.localSaved) {
            hextechScoreStatus.textContent = "✓ 成绩已保存在本机；云端暂未确认，将在下次打开海克斯全球榜时自动补传。";
        } else {
            hextechScoreStatus.textContent = "成绩未能保存：" + String(result && result.error && result.error.message || "请确认已设置全站昵称后重试。");
        }
    }).catch(error => {
        if (hextechScoreStatus) hextechScoreStatus.textContent = "云端暂不可用，成绩提交失败：" + String(error && error.message || "请稍后再试。");
    });
}
function resetHextechRun() {
    hextechModeActive = window.mergeGameMode === "hextech"; hextechOwned = []; hextechOffersTaken = 0; hextechOfferedAugments = []; hextechClearUsed = new Set();
    hextechScoreMultiplier = 1; hextechBonusPerMerge = 0; hextechRareChanceBonus = 0; hextechRareScoreMultiplier = 3;
    hextechComboWindowMs = 4500; hextechComboThreshold = 3; hextechComboMultiplier = 1.5;
    hextechDropCooldownMs = 250; hextechDropRecoveryMs = 450; hextechEventFrequencyMultiplier = 1;
    hextechShieldCharges = 0; hextechSmallMergeMultiplier = 1; hextechTripleMergesRemaining = 0; hextechEveryFiveMergesBonus = 0;
    hextechHighLevelMultiplier = 1; hextechEveryThreeMergesBonus = 0; hextechEveryTenMergesBonus = 0; hextechComboFlatBonus = 0;
    try { bestScore = Number(localStorage.getItem(hextechModeActive ? "mergeHexBestScore" : "mergeBestScore")) || 0; } catch (_) { bestScore = 0; }
    bestScoreElement.textContent = bestScore;
    hextechScoreSubmitted = false;
    if (hextechScoreStatus) {
        hextechScoreStatus.classList.add("hidden");
        hextechScoreStatus.textContent = "";
    }
    if (hextechOwnedInfo) {
        hextechOwnedInfo.classList.add("hidden");
        hextechOwnedInfo.textContent = "";
        delete hextechOwnedInfo.dataset.augmentId;
    }
    if (scoreSubmitArea) scoreSubmitArea.classList.toggle("hidden", hextechModeActive);
    if (hextechOverlay) hextechOverlay.classList.add("hidden");
    renderHextechStatus();
}
function triggerRandomEvent() {
    const event = Math.floor(Math.random() * 3);
    if (event === 0) {
        eventMultiplierUntil = Date.now() + 9000;
        showToast("⚡ 欧皇时间！接下来 9 秒合成双倍得分！");
    } else if (event === 1) {
        nextMergeBonus = true;
        showToast("🎁 群友应援！下一次合成额外加分！");
    } else {
        const bonus = 20 + Math.floor(Math.random() * 31);
        updateScore(bonus);
        showToast("🧧 群友红包！直接获得 +" + bonus + " 分！");
    }
}

// =============================================
// 六、圆形照片背景颜色
// =============================================

function getLevelColor(level) {

    const colors = [
        "#8dc7ff",
        "#8de0c0",
        "#ffda83",
        "#ffad91",
        "#d9a5ff",
        "#8db6ff",
        "#ff91c8",
        "#b2d980",
        "#ffd45c"
    ];

    return colors[level - 1] || "#dddddd";

}


// =============================================
// 七、创建圆形物体
// =============================================

function createBall(x, y, level) {

    const radius = RADII[level - 1];

    const ball = Bodies.circle(
        x,
        y,
        radius,
        {
            label: "photoBall",

            restitution: 0.08,

            friction: 0.12,

            frictionStatic: 0.3,

            density: 0.001,

            slop: 0.02,

            render: {
                visible: false
            }
        }
    );

    // 保存当前圆形的等级
    ball.level = level;
    ball.isRare = false;

    return ball;

}


// =============================================
// 八、创建游戏物理世界
// =============================================

function createGame() {

    // 如果已经存在游戏，先清理旧画布和物理引擎
    if (render) {

        Events.off(render);

        Render.stop(render);

        if (
            render.canvas &&
            render.canvas.parentNode
        ) {

            render.canvas.parentNode.removeChild(
                render.canvas
            );

        }

        render = null;

    }

    if (runner) {

        Runner.stop(runner);

        runner = null;

    }

    if (engine) {

        Events.off(engine);

        Composite.clear(
            engine.world,
            false
        );

        Engine.clear(engine);

        engine = null;

    }

    gameContainer.innerHTML = "";

    // 创建新的物理引擎
    engine = Engine.create();

    engine.gravity.y = 1;

    // 创建游戏画布
    render = Render.create({

        element: gameContainer,

        engine: engine,

        options: {

            width: GAME_WIDTH,

            height: GAME_HEIGHT,

            wireframes: false,

            background: "#ffffff",

            pixelRatio: 1

        }

    });


    // 创建地面
    const ground = Bodies.rectangle(

        GAME_WIDTH / 2,

        GAME_HEIGHT + WALL_THICKNESS / 2,

        GAME_WIDTH,

        WALL_THICKNESS,

        {
            isStatic: true,

            label: "wall",

            render: {
                visible: false
            }
        }

    );


    // 创建左墙
    const leftWall = Bodies.rectangle(

        -WALL_THICKNESS / 2,

        GAME_HEIGHT / 2,

        WALL_THICKNESS,

        GAME_HEIGHT * 2,

        {
            isStatic: true,

            label: "wall",

            render: {
                visible: false
            }
        }

    );


    // 创建右墙
    const rightWall = Bodies.rectangle(

        GAME_WIDTH + WALL_THICKNESS / 2,

        GAME_HEIGHT / 2,

        WALL_THICKNESS,

        GAME_HEIGHT * 2,

        {
            isStatic: true,

            label: "wall",

            render: {
                visible: false
            }
        }

    );


    // 将墙壁加入物理世界
    Composite.add(
        engine.world,
        [
            ground,
            leftWall,
            rightWall
        ]
    );


    // 物理引擎每次检测到碰撞时执行
    Events.on(
        engine,
        "collisionStart",
        handleCollision
    );


    // 每次物理更新时检测游戏结束
    Events.on(
        engine,
        "beforeUpdate",
        checkGameState
    );


    // 每次绘制后绘制圆形照片
    Events.on(
        render,
        "afterRender",
        drawGame
    );


    // 启动画布渲染
    Render.run(render);

    // 创建物理运行器
    runner = Runner.create();

    Runner.run(
        runner,
        engine
    );


    // 绑定鼠标与触屏控制
    bindInputEvents();

}


// =============================================
// 九、自动把普通图片裁剪为圆形
// =============================================

function drawCircularImage(
    ctx,
    img,
    x,
    y,
    radius,
    level,
    isRare = false
) {

    ctx.save();

    // 创建圆形裁剪区域
    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.closePath();

    ctx.clip();


    // 先填充背景
    ctx.fillStyle = getLevelColor(level);

    ctx.fillRect(
        x - radius,
        y - radius,
        radius * 2,
        radius * 2
    );


    // 图片加载完成后绘制
    if (
        img &&
        img.complete &&
        img.naturalWidth > 0
    ) {

        const sourceWidth = img.naturalWidth;

        const sourceHeight = img.naturalHeight;

        // 中心裁剪为正方形
        const sourceSize = Math.min(
            sourceWidth,
            sourceHeight
        );

        const sourceX =
            (sourceWidth - sourceSize) / 2;

        const sourceY =
            (sourceHeight - sourceSize) / 2;


        // 把正方形图片绘制到圆形区域
        ctx.drawImage(

            img,

            sourceX,
            sourceY,

            sourceSize,
            sourceSize,

            x - radius,
            y - radius,

            radius * 2,
            radius * 2

        );

    } else {

        // 图片尚未加载时显示等级数字
        ctx.fillStyle = "#ffffff";

        ctx.font =
            `bold ${Math.max(16, radius * 0.8)}px Arial`;

        ctx.textAlign = "center";

        ctx.textBaseline = "middle";

        ctx.fillText(
            level,
            x,
            y
        );

    }

    ctx.restore();


    // 稀有群友带有金色光环
    if (isRare) {
        ctx.save();
        ctx.shadowColor = "#ffbf36";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffbf36";
        ctx.lineWidth = Math.max(3, radius * 0.09);
        ctx.stroke();
        ctx.restore();
    }

    // 绘制白色圆形边框
    ctx.save();

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle = "#ffffff";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.restore();

}


// =============================================
// 十、绘制整个游戏画面
// =============================================

function drawGame() {

    if (!render || !engine) {
        return;
    }

    const ctx = render.context;


    // 顶部提示区域
    ctx.save();

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
        0,
        0,
        GAME_WIDTH,
        DROP_LINE_Y
    );


    ctx.fillStyle = "#555555";

    ctx.font = "14px Microsoft YaHei, Arial";

    ctx.textAlign = "center";

    ctx.textBaseline = "middle";

    ctx.fillText(

        started && !paused && !gameOver
            ? "点击任意位置投放球球 · 越靠近同级越容易合成"
            : "点击开始游戏",

        GAME_WIDTH / 2,

        25

    );


    // 投放区域分界线
    ctx.strokeStyle = "#dddddd";

    ctx.setLineDash([6, 5]);

    ctx.beginPath();

    ctx.moveTo(
        0,
        DROP_LINE_Y
    );

    ctx.lineTo(
        GAME_WIDTH,
        DROP_LINE_Y
    );

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.restore();


    // 绘制所有已经放下的圆形
    const bodies =
        Composite.allBodies(engine.world);

    for (const body of bodies) {

        if (body.label !== "photoBall") {
            continue;
        }

        drawCircularImage(

            ctx,

            images[body.level - 1],

            body.position.x,

            body.position.y,

            RADII[body.level - 1],

            body.level,
            body.isRare

        );

    }


    // 绘制鼠标控制的预览圆形
    if (
        started &&
        !paused &&
        !gameOver &&
        !won &&
        canDrop
    ) {

        const radius = RADII[nextLevel - 1];

        const minX = radius + 5;

        const maxX =
            GAME_WIDTH - radius - 5;

        pointerX = Math.max(

            minX,

            Math.min(
                maxX,
                pointerX
            )

        );


        // 半透明预览
        ctx.save();

        ctx.globalAlpha = 0.75;

        drawCircularImage(

            ctx,

            images[nextLevel - 1],

            pointerX,

            DROP_LINE_Y / 2 + 15,

            radius,

            nextLevel,
            false

        );

        ctx.restore();


        // 投放参考线
        ctx.save();

        ctx.strokeStyle = "#bbbbbb";

        ctx.setLineDash([4, 5]);

        ctx.beginPath();

        ctx.moveTo(
            pointerX,
            DROP_LINE_Y
        );

        ctx.lineTo(
            pointerX,
            GAME_HEIGHT
        );

        ctx.stroke();

        ctx.restore();

    }

}


// =============================================
// 十一、绘制下一个照片预览
// =============================================

function drawNextPreview() {

    nextCtx.clearRect(
        0,
        0,
        nextCanvas.width,
        nextCanvas.height
    );

    const radius = 29;

    drawCircularImage(

        nextCtx,

        images[nextLevel - 1],

        40,

        40,

        radius,

        nextLevel

    );

}


// =============================================
// 十二、更新分数与最高分
// =============================================

function updateScore(points) {

    score += points;

    scoreElement.textContent = score;

    if (score > bestScore) {

        bestScore = score;

        bestScoreElement.textContent =
            bestScore;

        try {

            localStorage.setItem(
                hextechModeActive ? "mergeHexBestScore" : "mergeBestScore",
                String(bestScore)
            );

        } catch (error) {

            // 无法保存最高分时不影响游戏

        }

    }

}


// =============================================
// 十三、随机选择下一个照片
// =============================================

function chooseNextLevel() {

    const random = Math.random();

    // 55%概率出现第一级
    if (random < 0.55) {

        nextLevel = 1;

    }

    // 30%概率出现第二级
    else if (random < 0.85) {

        nextLevel = 2;

    }

    // 15%概率出现第三级
    else {

        nextLevel = 3;

    }

    drawNextPreview();

}


// =============================================
// 十四、放下圆形照片
// =============================================

function dropBall() {

    if (
        !started ||
        paused ||
        gameOver ||
        won ||
        !canDrop
    ) {
        return;
    }

    const now = Date.now();

    // 防止连续点击造成异常
    if (now - lastDropTime < (hextechModeActive ? hextechDropCooldownMs : 250)) {
        return;
    }

    lastDropTime = now;

    const radius = RADII[nextLevel - 1];

    const minX = radius + 5;

    const maxX =
        GAME_WIDTH - radius - 5;

    const x = Math.max(

        minX,

        Math.min(
            maxX,
            pointerX
        )

    );

    const ball = createBall(

        x,

        DROP_LINE_Y / 2 + 15,

        nextLevel

    );

    Composite.add(
        engine.world,
        ball
    );
    roundDrops++;
    progressData.totalDrops = (progressData.totalDrops || 0) + 1;
    saveProgress();
    dailyData.drops = (dailyData.drops || 0) + 1;
    saveDaily();
    updateProgressUI();

    canDrop = false;


    // 等待一小段时间后才能再次投放
    setTimeout(() => {

        if (
            started &&
            !gameOver &&
            !won
        ) {

            canDrop = true;

        }

    }, hextechModeActive ? hextechDropRecoveryMs : 450);


    // 更新下一张照片
    chooseNextLevel();

}


// =============================================
// 十五、检测碰撞
// =============================================

function handleCollision(event) {

    if (
        !started ||
        paused ||
        gameOver ||
        won
    ) {
        return;
    }

    for (const pair of event.pairs) {

        const bodyA = pair.bodyA;

        const bodyB = pair.bodyB;


        // 只处理照片圆形
        if (
            bodyA.label !== "photoBall" ||
            bodyB.label !== "photoBall"
        ) {
            continue;
        }


        // 等级不同不能合成
        if (bodyA.level !== bodyB.level) {
            continue;
        }


        // 第九级也允许与同级继续合成，累计更高分数。

        // 防止重复合成
        if (
            mergingBodies.has(bodyA.id) ||
            mergingBodies.has(bodyB.id)
        ) {
            continue;
        }


        // 锁定两个圆形
        mergingBodies.add(bodyA.id);

        mergingBodies.add(bodyB.id);


        // 记录本次合成
        mergeQueue.push({

            bodyA: bodyA,

            bodyB: bodyB,

            level: bodyA.level

        });

    }


    // 延迟到当前碰撞事件处理结束后再合成
    if (mergeQueue.length > 0) {

        setTimeout(
            processMergeQueue,
            0
        );

    }

}


// =============================================
// 十六、处理圆形合成
// =============================================

function processMergeQueue() {

    if (
        !engine ||
        gameOver ||
        won
    ) {

        mergeQueue = [];

        mergingBodies.clear();

        return;

    }

    const queue = mergeQueue;

    mergeQueue = [];


    for (const item of queue) {

        const bodyA = item.bodyA;

        const bodyB = item.bodyB;


        // 如果两个圆形已被移除，就跳过
        if (

            !Composite.get(
                engine.world,
                bodyA.id,
                "body"
            )

            ||

            !Composite.get(
                engine.world,
                bodyB.id,
                "body"
            )

        ) {

            mergingBodies.delete(bodyA.id);

            mergingBodies.delete(bodyB.id);

            continue;

        }


        const newLevel = Math.min(item.level + 1, LEVEL_COUNT);


        // 新圆形的位置取两个旧圆形的中间
        const x = (

            bodyA.position.x +

            bodyB.position.x

        ) / 2;


        const y = (

            bodyA.position.y +

            bodyB.position.y

        ) / 2;


        // 移除原来的两个圆形
        Composite.remove(
            engine.world,
            bodyA
        );

        Composite.remove(
            engine.world,
            bodyB
        );


        mergingBodies.delete(bodyA.id);

        mergingBodies.delete(bodyB.id);


        // 连击、活动倍率、海克斯强化与稀有群友奖励
        const now = Date.now();
        const comboThreshold = hextechModeActive ? hextechComboThreshold : 3;
        const comboMultiplier = hextechModeActive ? hextechComboMultiplier : 1.5;
        const comboWindow = hextechModeActive ? hextechComboWindowMs : 4500;
        comboCount = now - lastMergeAt <= comboWindow ? comboCount + 1 : 1;
        lastMergeAt = now;
        roundMerges++;
        renderHextechStatus();
        const multiplier = (now < eventMultiplierUntil ? 2 : 1) * (comboCount >= comboThreshold ? comboMultiplier : 1);
        const rareChance = hextechModeActive ? Math.min(0.5, 0.09 + hextechRareChanceBonus) : 0.09;
        const isRare = Math.random() < rareChance;
        let earned = Math.round(LEVEL_SCORES[newLevel - 1] * multiplier * (hextechModeActive ? hextechScoreMultiplier : 1));
        if (hextechModeActive && newLevel >= 5) earned = Math.round(earned * hextechHighLevelMultiplier);
        if (hextechModeActive && item.level <= 3) earned = Math.round(earned * hextechSmallMergeMultiplier);
        if (hextechModeActive && hextechTripleMergesRemaining > 0) { earned *= 3; hextechTripleMergesRemaining--; }
        if (hextechModeActive) {
            earned += hextechBonusPerMerge;
            if (roundMerges % 3 === 0) earned += hextechEveryThreeMergesBonus;
            if (roundMerges % 5 === 0) earned += hextechEveryFiveMergesBonus;
            if (roundMerges % 10 === 0) earned += hextechEveryTenMergesBonus;
            if (comboCount >= comboThreshold) earned += hextechComboFlatBonus;
        }
        if (nextMergeBonus) {
            earned += LEVEL_SCORES[newLevel - 1] * 2;
            nextMergeBonus = false;
            showToast("🎁 群友应援！本次合成额外加分");
        }
        if (isRare) {
            earned *= hextechModeActive ? hextechRareScoreMultiplier : 3;
            roundRare++;
            showToast("✨ 欧皇！发现闪光群友，" + (hextechModeActive ? hextechRareScoreMultiplier : 3) + " 倍合成分！");
        } else if (comboCount >= comboThreshold) {
            showToast("🔥 " + comboCount + " 连击！得分 x" + comboMultiplier);
        } else if (now < eventMultiplierUntil) {
            showToast("⚡ 双倍时间！得分翻倍");
        }
        updateScore(earned);
        discoverLevel(item.level);
        discoverLevel(newLevel);
        if (isRare) discoverRare(newLevel);
        updateDailyProgress();
        updateProgressUI();


        // 合成第九级，立即获胜
        if (newLevel === LEVEL_COUNT) {

            const finalBall = createBall(

                x,

                y,

                LEVEL_COUNT

            );
            finalBall.isRare = isRare;

            Composite.add(
                engine.world,
                finalBall
            );

            winGame();

            return;

        }


        // 创建升级后的圆形
        const newBall = createBall(

            x,

            y,

            newLevel

        );
        newBall.isRare = isRare;


        // 新圆形稍微向上弹起
        Body.setVelocity(

            newBall,

            {
                x: 0,
                y: -2
            }

        );


        // 加入物理世界
        Composite.add(
            engine.world,
            newBall
        );

    }


    // 清理合成锁
    mergingBodies.clear();
    offerHextechIfDue();

}


// =============================================
// 十七、检测游戏是否结束
// =============================================

function checkGameState() {

    if (
        !started ||
        paused ||
        gameOver ||
        won
    ) {
        return;
    }

    const bodies =
        Composite.allBodies(engine.world);

    const now = Date.now();
    if (now >= nextEventAt) {
        triggerRandomEvent();
        nextEventAt = now + (18000 + Math.random() * 16000) * (hextechModeActive ? hextechEventFrequencyMultiplier : 1);
    }

    let dangerous = false;


    for (const body of bodies) {

        if (body.label !== "photoBall") {
            continue;
        }

        const radius =
            RADII[body.level - 1];


        // 判断圆形是否靠近顶部
        const nearTop =
            body.position.y - radius <
            DROP_LINE_Y + 5;


        // 判断圆形是否基本停止移动
        const almostStopped =

            Math.abs(body.velocity.y) < 0.2

            &&

            Math.abs(body.velocity.x) < 0.2;


        if (
            nearTop &&
            almostStopped
        ) {

            dangerous = true;

            break;

        }

    }


    if (dangerous) {

        if (gameOverTimer === 0) {

            gameOverTimer = now;

        }


        if (now - gameOverTimer > GAME_OVER_DELAY) {
            if (hextechModeActive && hextechShieldCharges > 0) {
                hextechShieldCharges -= 1;
                gameOverTimer = 0;
                showToast("🛡️ 救场护盾触发！这次险情被化解了。");
                renderHextechStatus();
            } else {
                endGame();
            }
        }

    } else {

        gameOverTimer = 0;

    }

}


// =============================================
// 十八、显示结果提示
// =============================================

function showMessage(title, text) {

    messageTitle.textContent = title;

    messageText.textContent = text;

    message.classList.remove("hidden");

}


// =============================================
function formatElapsedTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "—";
    return (ms / 1000).toFixed(2) + " 秒";
}

// 十九、获胜
// =============================================

function winGame() {
    // 首次合成第九级只弹出祝贺提示，不结束本局；玩家可以继续合成冲击更高分。
    if (gameOver || level9Celebrated) return;
    level9Celebrated = true;
    level9ElapsedMs = Math.max(0, Date.now() - gameStartedAt);
    paused = true;
    Runner.stop(runner);
    pauseBtn.disabled = false;
    pauseBtn.textContent = "继续游戏";
    messageRestart.textContent = "继续合成";
    showMessage(
        "🎉 恭喜合成 Level 9！",
        `你已经合成最高等级！本局用时：${formatElapsedTime(level9ElapsedMs)}。游戏还没有结束，点击“继续合成”，挑战更高分数吧！当前得分：${score}`
    );
}


// =============================================
// 二十、游戏结束
// =============================================

function endGame() {

    if (gameOver || won) return;

    gameOver = true;

    started = false;

    pauseBtn.disabled = true;

    if (!hextechModeActive && window.finishAndOfferScore) window.finishAndOfferScore(score, level9ElapsedMs, level9Celebrated);
    if (hextechModeActive && scoreSubmitArea) scoreSubmitArea.classList.add("hidden");
    if (hextechModeActive) submitHextechRunScore();
    messageRestart.textContent = "再玩一次";
    showMessage(
        hextechModeActive ? "⚡ 海克斯挑战结束" : "游戏结束",
        hextechModeActive
            ? "照片堆得太高了！本局得分：" + score + "。海克斯模式本机最高分：" + bestScore + "。成绩单独保存，不计入经典全球排行榜。"
            : `照片堆得太高了！你的最终得分：${score}`
    );

}


// =============================================
// 主动结束本局，并允许提交当前分数
// =============================================

function stopGameManually() {
    if (!started || gameOver || won) return;

    gameOver = true;
    started = false;
    paused = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "暂停游戏";
    Runner.stop(runner);

    if (!hextechModeActive && window.finishAndOfferScore) window.finishAndOfferScore(score, level9ElapsedMs, level9Celebrated);
    if (hextechModeActive && scoreSubmitArea) scoreSubmitArea.classList.add("hidden");
    if (hextechModeActive) submitHextechRunScore();
    messageRestart.textContent = "再玩一次";
    showMessage(
        hextechModeActive ? "⚡ 海克斯挑战结束" : "本局已结束",
        hextechModeActive
            ? "你主动结束了海克斯挑战，本局得分：" + score + "。海克斯模式本机最高分：" + bestScore + "。成绩单独保存，不计入经典全球排行榜。"
            : `你主动结束了本局，当前得分：${score}。可以提交成绩到排行榜，也可以再玩一次。`
    );
}


// =============================================
// 二十一、开始或重新开始游戏
// =============================================

function startGame() {

    // 选择模式并重置本局强化，然后重建物理世界
    resetHextechRun();
    createGame();


    // 重置分数与通关计时
    score = 0;
    gameStartedAt = Date.now();
    level9ElapsedMs = null;
    level9Celebrated = false;
    messageRestart.textContent = "再玩一次";

    scoreElement.textContent = "0";


    // 重置状态
    started = true;

    paused = false;

    gameOver = false;

    won = false;

    canDrop = true;

    lastDropTime = 0;

    gameOverTimer = 0;
    comboCount = 0;
    lastMergeAt = 0;
    eventMultiplierUntil = 0;
    nextMergeBonus = false;
    nextEventAt = Date.now() + 12000 + Math.random() * 10000;
    roundDrops = 0;
    roundMerges = 0;
    roundRare = 0;
    renderHextechStatus();
    dailyData.games = (dailyData.games || 0) + 1;
    saveDaily();
    updateProgressUI();

    pointerX = GAME_WIDTH / 2;


    // 清理合成队列
    mergeQueue = [];

    mergingBodies.clear();


    // 隐藏结束提示
    message.classList.add("hidden");


    // 恢复按钮
    pauseBtn.disabled = false;

    pauseBtn.textContent = "暂停游戏";


    // 选择下一张照片
    chooseNextLevel();

    drawNextPreview();

}


// =============================================
// 二十二、暂停与继续
// =============================================

function togglePause() {

    if (
        !started ||
        gameOver ||
        won
    ) {
        return;
    }


    paused = !paused;


    if (paused) {

        pauseBtn.textContent = "继续游戏";

        Runner.stop(runner);

    } else {

        pauseBtn.textContent = "暂停游戏";

        Runner.run(
            runner,
            engine
        );

    }

}


// =============================================
// 二十三、鼠标位置转换
// =============================================

function updatePointer(clientX, clientY) {

    if (!render) {
        return;
    }

    const rect =
        render.canvas.getBoundingClientRect();

    const scaleX =
        GAME_WIDTH / rect.width;

    pointerX =
        (clientX - rect.left) * scaleX;


    // 防止圆形超出左右边界
    const radius =
        RADII[nextLevel - 1];

    pointerX = Math.max(

        radius + 5,

        Math.min(

            GAME_WIDTH - radius - 5,

            pointerX

        )

    );

}


// =============================================
// 二十四、绑定鼠标与触屏事件
// =============================================

function bindInputEvents() {

    if (
        !render ||
        !render.canvas
    ) {
        return;
    }

    const canvas = render.canvas;


    // 鼠标移动
    canvas.addEventListener(

        "mousemove",

        function (event) {

            updatePointer(
                event.clientX,
                event.clientY
            );

        }

    );


    // 鼠标点击放下
    canvas.addEventListener(

        "click",

        function (event) {
            // 以点击位置作为投放位置，不需要先移动鼠标。
            updatePointer(event.clientX, event.clientY);
            dropBall();
        }

    );


    // 触屏移动
    canvas.addEventListener(

        "touchmove",

        function (event) {

            if (event.touches.length > 0) {

                updatePointer(

                    event.touches[0].clientX,

                    event.touches[0].clientY

                );

            }

        },

        {
            passive: false
        }

    );


    // 触屏松开后放下
    canvas.addEventListener(

        "touchend",

        function (event) {
            // 使用手指离开屏幕的位置投放，点按即可，不必先滑动。
            const touch = event.changedTouches && event.changedTouches[0];
            if (touch) updatePointer(touch.clientX, touch.clientY);
            dropBall();
        },
        {
            passive: false
        }

    );

}


// =============================================
// 二十五、按钮事件
// =============================================

startBtn.addEventListener(

    "click",

    startGame

);


restartBtn.addEventListener(

    "click",

    startGame

);


messageRestart.addEventListener(
    "click",
    function () {
        if (level9Celebrated && !gameOver) {
            message.classList.add("hidden");
            if (offerHextechIfDue()) return;
            paused = false;
            pauseBtn.disabled = false;
            pauseBtn.textContent = "暂停游戏";
            messageRestart.textContent = "再玩一次";
            Runner.run(runner, engine);
            return;
        }
        startGame();
    }
);


pauseBtn.addEventListener(

    "click",

    togglePause

);

stopBtnBottom.addEventListener("click", stopGameManually);

const collectionOpenBtn = document.getElementById("collectionOpenBtn");
const collectionBackBtn = document.getElementById("collectionBackBtn");
const gameView = document.getElementById("gameView");
const collectionView = document.getElementById("collectionView");
if (collectionOpenBtn && collectionView && gameView) {
    collectionOpenBtn.addEventListener("click", function () {
        gameView.classList.add("hidden");
        collectionView.classList.remove("hidden");
        renderProgress();
        window.scrollTo(0, 0);
    });
}
if (collectionBackBtn && collectionView && gameView) {
    collectionBackBtn.addEventListener("click", function () {
        collectionView.classList.add("hidden");
        gameView.classList.remove("hidden");
        window.scrollTo(0, 0);
    });
}


window.renderProgress = renderProgress;

// =============================================
// 二十六、初始化游戏
// =============================================

// 首次加载时创建游戏区域
createGame();

// 初始状态不开始游戏
started = false;

paused = true;

// 暂停物理模拟，但保留画面
Runner.stop(runner);

// 初始化下一个照片预览
chooseNextLevel();

drawNextPreview();

// 初始化按钮
pauseBtn.disabled = true;