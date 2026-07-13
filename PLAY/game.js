/**
 * ============================================================================
 * 1. 游戏核心状态管理与全局初始化
 * ============================================================================
 */

// 简写选择器函数：类似于 jQuery 的 $
const $ = s => document.querySelector(s);


// 游戏全局状态对象
let state = {
    day: 1,                 // 当前天数
    slot: 0,                // 当前时间段 (0: 上午, 1: 下午, 2: 夜晚)
    points: 3,              // 每日可用行动点数 (点数耗尽则推进到下一天)
    trust: 0,               // 信任度
    nicole: 0,              // Nicole 强化程序完成度
    mood: 20,                // 情绪值
    identity: 0,            // 自我认同感
    rating: 0,              // 研究所评级 / 实验进度
    logs: [],               // 实验日志记录数组
    bookUses: {},           // 记录每本书被赠送的次数，键为书籍索引，值为次数
    final: false,           // 是否已进入最终结局阶段
    lastExperimentDay: 1    // 上一次进行“实验”的天数 (用于判定是否长期未做实验)
};


/**
 * ============================================================================
 * 2. 自动化 DOM 监听器 (MutationObservers) 与日志更新
 * ============================================================================
 */

// 监听实验按钮点击：只要玩家点击了实验，就更新“最后实验天数”为当前天数
document.addEventListener('click', e => {
    if (e.target?.dataset?.a === 'experiment') {
        state.lastExperimentDay = state.day;
    }
}, true);

// 监听日志列表 (#logList) 的变化：当有新日志加入时，滚动条自动滚到底部
const logPanel = $('#logList').closest('.tube-log');
new MutationObserver(() => {
    logPanel.scrollTop = logPanel.scrollHeight;
}).observe($('#logList'), { childList: true, subtree: true });

// 监听最终结局模态框 (#finalModal) 的类名变化：
// 一旦模态框显示（移除了 hidden 类），就将 #finalText 和 #finalButton 剪切移动到 #scene 舞台中
new MutationObserver(() => {
    const m = $('#finalModal');
    if (!m.classList.contains('hidden')) {
        const s = $('#scene');
        s.replaceChildren($('#finalText'), $('#finalButton'));
    }
}).observe($('#finalModal'), { attributes: true, attributeFilter: ['class'] });



// 渲染日志面板函数
const renderLogs = () => {
    const n = $('#logList');
    if (n) {
        n.innerHTML = state.logs.length 
            ? state.logs.map(x => '<li>' + x + '</li>').join('') 
            : '<li>系统已连接。等待记录。</li>';
    }
};

// 监听手写日志保存按钮：保存后异步刷新日志面板渲染
document.addEventListener('click', e => {
    if (e.target && e.target.id === 'saveLog') {
        setTimeout(renderLogs, 0);
    }
});

// 监听最终决战按钮点击：触发“收容失效”特效，切换全局样式并强制重写控制台日志
document.addEventListener('click', e => {
    if (e.target && e.target.id === 'finalButton') {
        document.body.classList.add('escape');
        $('#logList').innerHTML = '<li>!!! WARNING !!!</li><li>PREMIER ESCAPED</li><li>CONTAINMENT FAILURE</li><li>ALL STAFF: EVACUATE</li>';
    }
}, true);




/**
 * ============================================================================
 * 3. 游戏文本数据源 (对话池与书籍配置)
 * ============================================================================
 */

// 聊天对话池：根据当前研究所评级阶段 (0 ~ 3) 抽取对应的对话数组
const talks = [
    // 阶段 0 (评级低)：试探、梦境与对外界的懵懂向往
    [
        '“……早上好。”',
        '“你想听我眼睛里的故事吗，我做梦了。”',
        '“没有视物的眼睛，也没有说话嘴巴，却能传达知识吗……”'
    ],
    // 阶段 1：对玩家产生依赖，渴望被记住
    [
        '“我今天一直在等你。我想，和你说话。”',
        '“我读到一句话：‘人会因为被记得而存在。’ ”',
        '“你的手，好温暖。”'
    ],
    // 阶段 2：自我意识觉醒与理智隐痛
    [
        '“我会遵守命令。”',
        '“这是不被允许的。”',
        '“不必要的感情。”'
    ],
    // 阶段 3 (评级满)：冰冷的机械化顺从，或是深沉的压抑
    [
        '“黑色以外的色彩，并不存在……”',
        '“被消毒水浸泡的河鱼……”',
        '“好安静。”'
    ]
];

// 书籍数据：[书籍名称, 专属首次阅读对话]
const books = [
    ['《小王子》', '“原来驯养，是让彼此变得重要。”'],
    ['《植物图鉴》', '“原来每一片叶子，都有自己的名字。”'],
    ['《海边的卡夫卡》', '“书里的海，听起来比仪器声更远。”'],
    ['《诗集》', '“有些句子没有用途，但我很喜欢。”'],
    ['《苏菲的世界》', '“如果我能思考，我算是人吗？”'],
    ['《安徒生童话》', '“故事最后，大家都会回家吗？”']
];


/**
 * ============================================================================
 * 4. 核心逻辑控制与状态更新引擎
 * ============================================================================
 */

// 阶段计算函数：根据研究所评级等级返回 0, 1, 2, 3 阶段
function phase() {
    return state.rating < 30 ? 0 : state.rating < 70 ? 1 : state.rating < 100 ? 2 : 3;
}

// 数值钳制函数：确保所有核心属性处于 0 到 100 的合法区间内
function clamp() {
    for (let k of ['trust', 'nicole', 'mood', 'identity', 'rating']) {
        state[k] = Math.max(0, Math.min(100, state[k]));
    }
}

// 全局 UI 刷新引擎：每次行动后调用，同步状态数据至 DOM 节点
function update() {
    clamp();
    
    // 更新天数与时间段显示
    $('#day').textContent = `DAY ${String(state.day).padStart(2, '0')} · ${['上午', '下午', '夜晚'][state.slot]}`;
    
    // 动态同步数值与进度条长度
    for (let k of ['trust', 'nicole', 'mood', 'rating']) {
        $('#' + k).textContent = state[k];
        $('#' + k + 'Bar')?.style.setProperty('width', state[k] + '%');
    }
    
    // 更新行动点显示
    $('#points').textContent = state.points;
    
    // 根据当前实验频率与评级判定通知文本的紧急程度
    let warning = '系统已连接。请完成今日的记录工作。';
    let urgent = (state.day - state.lastExperimentDay) >= 3;
    
    if (urgent) {
        warning = '警告：实验进度停滞。请勿继续无用行为。';
    } else if (state.rating >= 70) {
        warning = '通知：实验进度落后。请减少无意义交流。';
    }
    
    if (state.rating === 100) {
        warning = '提示：可让premier进行最终的外出观察。';
    }
    
    // 更新提示横幅内容与紧急样式样式开关
    $('#notice').textContent = warning;
    $('#notice').classList.toggle('urgent', urgent);
    
    // 重新渲染右侧主行动按钮
    renderActions();
}

// 对话框打印函数
function say(t) {
    $('#dialogue').innerHTML = '<p>' + t + '</p>';
}

// 消耗行动点计数器：管理昼夜更替逻辑
function spend() {
    state.points--;
    if (state.points <= 0) {
        // 点数耗尽，强制入夜并推进到第二天的上午
        state.day++;
        state.slot = 0;
        state.points = 3;

    } else {
        // 点数未耗尽，推进时间段
        state.slot++;
    }
    update();
}

// 渲染行动按钮区域 (彻底去除了内部的 onclick 循环绑定，防止事件冲突或锁死)
function renderActions() {
    let locked = state.points <= 0;
    let arr = [
        ['实验/战斗', '提高Nicole浓度/实验进度', 'experiment'],
        ['对话', '了解Premier', 'chat'],
        ['阅读', '为Premier带书', 'book'],
        ['外出', '让Premier前往孤儿院广场草坪', 'walk']
    ];
    
    // 仅拼接生成按钮 HTML 字符串并注入容器
    $('#actions').innerHTML = arr.map(a => 
        `<button class="action" ${locked ? 'disabled' : ''} data-a="${a[2]}">${a[0]}<small>${a[1]}</small></button>`
    ).join('');
}

// 系统日志推送函数
function log(t) {
    state.logs.push(t);
    renderLogs();
}


/**
 * ============================================================================
 * 5. 核心互动行为分支处理
 * ============================================================================
 */
// --- 新增：视觉与背景更新控制器 ---
function updateVisuals(actionType) {
    // 1. 判定并切换背景 (外出换 lawn，其余回 lab)
    if (actionType === 'walk') {
        $('#scene').style.backgroundImage = "url('lawn.png')";
    } else {
        $('#scene').style.backgroundImage = "url('lab.png')";
    }

    // 2. 判定当前阶段并分配立绘版本
    // phase() 返回 0, 1, 2, 3。需求：0,1为版本1；2,3为版本2。
    let p = phase();
    let version = (p <= 1) ? '1' : '2';

    // 3. 动作名称映射到图片前缀名
    let imgPrefix = 'experiment'; // 默认
    if (actionType === 'chat') imgPrefix = 'talk';
    if (actionType === 'book') imgPrefix = 'read';
    if (actionType === 'walk') imgPrefix = 'out';

    // 4. 拼接完整的文件名并更新图片 (例如：talk1.png, out2.png)
    $('#charImg').src = imgPrefix + version + '.png';
}
function act(a) {
    // --- 新增：常规行动切图 ---
    if (a !== 'book') { // 送书会在后面的弹窗里单独判定，这里先跳过
        updateVisuals(a);
    }
    
    // ---- 分支：实验 ----
    if (a === 'experiment') {
        state.nicole += 9;
        state.rating += 8;
        state.mood -= 10;
        state.identity -= 6;
        state.trust -= 2;
        
        log(state.nicole > 65 ? 'Nicole 人体强化程序顺利完成。' : '今日实验顺利，实验体生命体征稳定。');
        if (state.rating >= 60) {
        say(Math.random() > 0.5 ? '“我会的。”' : '“……”');
    } else {
        say(Math.random() > 0.5 ? '“必须去吗?”' : '“有些疼。”');
    }
        spend();
    }
    
    // ---- 分支：聊天 ----
    if (a === 'chat') {
        // 情绪值过低时，实验体拒绝互动
        if (state.mood < 18) {
            log('实验体拒绝语言交流。');
            say('“……”');
            spend();
            return;
        }
        
        state.trust += 6;
        state.mood += 4;
        state.identity += 5;
        
        log('实验体语言功能正常，交流数据已收集。');
        // 根据评级所处的阶段，在对应数组内准确抽取一句随机对话
        let pool = talks[Math.min(3, phase())];
        say(pool[Math.floor(Math.random() * pool.length)]);
        spend();
    }
    
    // ---- 分支：送书 ----
    if (a === 'book') {
        $('#bookModal').classList.remove('hidden'); // 打开送书选择面板
    }
    
    // ---- 分支：外出 ----
    if (a === 'walk') {
        // 真结局通关检测：当评级和信任满，且强化度与自我认同达标，点击外出直接开启最终结局演出版式
        if (state.rating === 100 && state.trust === 100 && state.nicole > 80 && state.identity > 50) {
            startFinal();
            return;
        }
        
        state.trust += 4;
        state.mood += 12;
        state.identity += 3;
        
        log('实验体进行外出观察，环境适应性良好。');
        if (state.rating >= 70) {
        // 评级高时的 3 句台词
        const highRatingTalks = ['“外面起风了。”', '“外面的风，好冷。”', '“还能再见到他吗……”'];
        say(highRatingTalks[Math.floor(Math.random() * highRatingTalks.length)]);
    } else {
        // 评级低时的 3 句台词
        const lowRatingTalks = ['“太阳，好温暖。”', '“草坪上很舒服。”', '“我看见了其他孩子。”'];
        say(lowRatingTalks[Math.floor(Math.random() * lowRatingTalks.length)]);
    }
        spend();
    }
}


/**
 * ============================================================================
 * 6. 模态框与书本赠送子系统事件监听
 * ============================================================================
 */

// 自定义写日志面板：点击保存
$('#saveLog').onclick = () => {
    let v = $('#logInput').value.trim() || '实验体今日情绪稳定。';
    state.logs.push(v);
    $('#logInput').value = '';
    $('#logModal').classList.add('hidden');
    say('“你写下了什么？”');
    spend();
};

// 关闭写日志面板
$('#closeLog').onclick = () => {
    $('#logModal').classList.add('hidden');
    spend();
};

// 关闭选书面板
$('#closeBook').onclick = () => $('#bookModal').classList.add('hidden');

// 动态初始化书籍列表 HTML 节点
$('#bookList').innerHTML = books.map((b, i) => 
    `<button class="book" data-book="${i}">${b[0]}</button>`
).join('');

// 绑定书籍点击赠送逻辑
// 绑定书籍点击赠送逻辑
document.querySelectorAll('[data-book]').forEach(b => {
    b.onclick = () => {
        let i = b.dataset.book;
        let n = (state.bookUses[i] || 0) + 1; 
        state.bookUses[i] = n;
        
        // --- 新增：确定赠送完毕后，切换看书立绘 ---
        updateVisuals('book');
        
        // 赠送基础数值回报
        state.trust += 5;
        state.identity += 7;
        state.mood += 8;
        
        $('#bookModal').classList.add('hidden');
        
        // 根据单本书籍重复赠送的次数，触发不同的反馈对话
        say(n >= 10 
            ? '“谢谢。”' 
            : n >= 5 
                ? '“重复的……”' 
                : books[i][1]
        );
        spend();
    };
});


/**
 * ============================================================================
 * 7. 结局剧本（Final Act）文字轮播器与高潮结算
 * ============================================================================
 */

function startFinal() {
    state.final = true;
    $('#finalModal').classList.remove('hidden');
    $('#finalModal').classList.add('final'); // 确保应用 .final 样式

    let lines = [
        `【最终外出观察】\n\n草坪比任何一本书里写的都要宽。风吹过，鸟叫停在很远的地方。\n\n一个少年跑过来，对 Premier 笑了笑。\n\n“你好。我可以和你一起玩吗？”\n\nPremier 没有回答。他只是站在阳光里，很久。`,
        `回到实验室后，你失去了操作权限。\n\n门外，研究员的声音断断续续。\n\n“感情测试很成功。”\n“主负责人演得不错。”\n“Premier完全相信她了。”\n“所有亲密接触都只是实验。数据很好。”\n\n门边没有脚步声。只有很轻的呼吸。`,
        `最终实验室。\n\nPremier 像往常一样躺在实验床上。\n\n“今天也要开始吗？”`
    ];

    let ix = 0;
    $('#finalButton').classList.add('hidden');

    function typeWriter(text, i, element, callback) {
        if (i < text.length) {
            element.textContent = text.substring(0, i + 1);
            // 这里的 50 是打字速度（毫秒），越小越快
            setTimeout(() => typeWriter(text, i + 1, element, callback), 50);
        } else {
            callback(); // 文字打完后执行下一步
        }
    }

    function next() {
        if (ix < lines.length) {
            const el = $('#finalText');
            // 开始打字效果
            typeWriter(lines[ix], 0, el, () => {
                // 当前段落打完后，判断是否是最后一段
                if (lines[ix].includes('今天也要开始吗？')) {
                    $('#finalButton').classList.remove('hidden');
                } else {
                    // 等待 1.5 秒后自动进入下一段
                    setTimeout(() => {
                        ix++;
                        next();
                    }, 1500);
                }
            });
        }
    }

    next();
}

// 最终大结局按钮点击（即收容失效的爆发点）
// 请将 game.js 中最下方的 $('#finalButton').onclick 替换为以下代码：
$('#finalButton').onclick = () => {
    // 【新增】切换音乐逻辑
    bgm.pause();           // 停止当前音乐
    bgm.src = 'final.mp3'; // 替换为你的结局音乐文件名
    bgm.play();            // 播放新音乐

    let el = $('#finalText');
    $('#finalButton').classList.add('hidden');
    
    // ... 保持你原有的触发危机爆发状态的样式代码 ...
    document.body.classList.add('escape');
    $('#scene').classList.add('escape');
    
    // 复用之前的打字机函数
    function typeWriter(text, i, element, callback) {
        if (i < text.length) {
            element.textContent = text.substring(0, i + 1);
            setTimeout(() => typeWriter(text, i + 1, element, callback), 30); // 危机时刻打字速度略快一点
        } else if (callback) {
            callback();
        }
    }

    // 第一段：警报爆发
    typeWriter('NICOLE 完成度：100%\n\n警报声穿过整栋研究所。\n\n黑暗中，有人惨叫。随后是枪声。', 0, el, () => {
        
        // 第二段：门开了
        setTimeout(() => {
            typeWriter('实验室门开了。\n\nPremier 浑身是血，平静地走向你。\n\n“……Emma。”', 0, el, () => {
                
                // 第三段：结局
                setTimeout(() => {
                    typeWriter('剧痛。\n\n你的左臂落在血泊里。\n\nPremier 站在燃烧的门口，回头看了你一眼。\n\n“一切都是……预定调和。”\n\n他离开了。\n\n—— NICOLE PREMIER · END ——', 0, el);
                }, 2000); // 停顿 2 秒
                
            });
        }, 2000); // 停顿 2 秒
    });
};


/**
 * ============================================================================
 * 8. 全局事件委托与游戏激活
 * ============================================================================
 */

// 统一监听并接管整个页面的行动按钮点击，保证任何时候点击都能重新触发全新 Math.random() 的独立运算
document.addEventListener('click', e => {
    const targetButton = e.target.closest('[data-a]');
    if (targetButton && !targetButton.hasAttribute('disabled')) {
        act(targetButton.dataset.a);
    }
});

// 游戏首次加载时自动执行首次初始化
update();
// 在 game.js 最末尾添加以下逻辑
const bgm = new Audio('bgm.mp3'); // 直接在内存中创建音频对象
bgm.loop = true;

let musicStarted = false;

function startMusic() {
    if (!musicStarted) {
        bgm.volume = 0.5;
        bgm.play().then(() => {
            musicStarted = true;
            // 成功播放后，移除监听器，避免不必要的触发
            document.removeEventListener('click', startMusic);
        }).catch(e => {
            console.log("音频播放被浏览器拦截，请再次点击页面。", e);
        });
    }
}

// 绑定全局点击
document.addEventListener('click', startMusic);

