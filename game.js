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
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    256
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

const message =
    document.getElementById("message");

const messageTitle =
    document.getElementById("message-title");

const messageText =
    document.getElementById("message-text");

const messageRestart =
    document.getElementById("message-restart");


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

// 正在合成的圆形ID
const mergingBodies = new Set();

// 待处理的合成事件
let mergeQueue = [];


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
    level
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
            ? "移动鼠标选择位置，点击放下"
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

            body.level

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

            nextLevel

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
                "mergeBestScore",
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
    if (now - lastDropTime < 250) {
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

    }, 450);


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


        // 第九级不能继续升级
        if (bodyA.level >= LEVEL_COUNT) {
            continue;
        }


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


        const newLevel = item.level + 1;


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


        // 增加合成分数
        updateScore(
            LEVEL_SCORES[newLevel - 1]
        );


        // 合成第九级，立即获胜
        if (newLevel === LEVEL_COUNT) {

            const finalBall = createBall(

                x,

                y,

                LEVEL_COUNT

            );

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


        if (
            now - gameOverTimer >
            GAME_OVER_DELAY
        ) {

            endGame();

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
// 十九、获胜
// =============================================

function winGame() {

    if (window.finishAndOfferScore) window.finishAndOfferScore(score);

    won = true;

    gameOver = true;

    started = false;

    pauseBtn.disabled = true;

    pauseBtn.textContent = "暂停游戏";

    showMessage(

        "恭喜你，挑战成功！",

        `你成功合成了第九级！最终得分：${score}`

    );

}


// =============================================
// 二十、游戏结束
// =============================================

function endGame() {

    if (window.finishAndOfferScore) window.finishAndOfferScore(score);

    if (
        gameOver ||
        won
    ) {
        return;
    }

    gameOver = true;

    started = false;

    pauseBtn.disabled = true;

    showMessage(

        "游戏结束",

        `照片堆得太高了！你的最终得分：${score}`

    );

}


// =============================================
// 二十一、开始或重新开始游戏
// =============================================

function startGame() {

    // 重置游戏物理世界
    createGame();


    // 重置分数
    score = 0;

    scoreElement.textContent = "0";


    // 重置状态
    started = true;

    paused = false;

    gameOver = false;

    won = false;

    canDrop = true;

    lastDropTime = 0;

    gameOverTimer = 0;

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

        function () {

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

    startGame

);


pauseBtn.addEventListener(

    "click",

    togglePause

);


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