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
    mood: 20,               // 情绪值
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

// 聊天对话池
const talks = [
    [
        '“……早上好。”',
        '“你想听我眼睛里的故事吗，我做梦了。”',
        '“没有视物的眼睛，也没有说话嘴巴，却能传达知识吗……”'
    ],
    [
        '“我今天一直在等你。我想，和你说话。”',
        '“我读到一句话：‘人会因为被记得而存在。’ ”',
        '“你的手，好温暖。”'
    ],
    [
        '“我会遵守命令。”',
        '“这是不被允许的。”',
        '“不必要的感情。”'
    ],
    [
        '“黑色以外的色彩，并不存在……”',
        '“被消毒水浸泡的河鱼……”',
        '“好安静。”'
    ]
];

// 结构：[书名, 前期对话(phase<2), 后期对话(phase>=2), 简介]
const books = [
    ['《帆》莱蒙托夫', '“……海？<br>……我可以，「想要看海」吗？”', '“一切终将归于……风暴。”', '在那大海上淡蓝色的云雾里，\n有一片孤帆儿在闪耀着白光！\n它寻求着什么，在遥远的异地？\n它抛下什么，在可爱的故乡？\n\n波涛在汹涌海风在呼啸，\n桅杆在弓起了腰轧轧地作响……\n唉！它不是在寻求什么幸福，\n也不是逃避幸福而奔向他方！\n\n下面是比蓝天还清澄的大海，\n上面是金黄色灿烂的太阳……\n而它，不安的，在祈求风暴，\n仿佛是在风暴中才有着安详！'],
    ['《婚约》洛尔迦', '“一直在等待吗？”', '“百年的……生命。<br>悲哀。”', '从水里捞起\n这个金指箍。\n\n（阴影把它的手指\n按住了我的肩窝。）\n\n把这金箍捞起，我的年纪\n早已过了百岁。静些！\n\n一句话也别问我！\n\n从水里捞起\n这个金指箍。'],
    ['《数数杏仁（无题）》保罗·策兰', '“妈妈。爸爸……<br>邻人。街道上的陌生人。<br>请问，哪里可以拿到杏仁？”', '“我也是……苦杏仁吗？”', '数数杏仁， \n数数苦的让你醒着的， \n把我也数进去： \n我寻找你的眼睛， \n你睁开无人看你， \n我纺那秘密的线 \n你在线上的沉思之露 \n落进被不能打动人心的词语 \n守护的水罐中。 \n\n你全部进入的名字才是你的， \n坚定地走向你自己， \n锤子在你沉默的钟楼自由摆动， \n无意中听见的够到你， \n死者也用双臂搂住你， \n你们三人步入夜晚。 \n\n让我变苦。 \n把我数进杏仁中。'],
    ['《假面的告白》三岛由纪夫', '“二十多岁以后的人是什么样的？<br>会穿上白衣服吧，就像这里的人一样。”', '“将来是不存在的。”', '战争教会我们奇妙的、感伤的成长方法。那就是到了二十多岁就打算斩断人生，然后一概不考虑将来怎样。人生对于我们来说，轻飘飘得不可思议。'],
    ['《卡拉马佐夫兄弟》陀思妥耶夫斯基', '“……我会变成坏人吗？”', '“……我们将彼此永不相忘。”', '我这样说只是唯恐我们变成坏人，”阿辽沙继续演讲，“可我们为什么一定会变成坏人，诸位，你们说对不？我们首先将是善良的，这一点最要紧，然后是正直的，然后——我们将彼此永不相忘。'],
    ['《被侮辱与被损害的》陀思妥耶夫斯基', '“活着……就能获得幸福吗？<br>我在想……我在想了。”', '“我尽力了。”', '我这样说只是唯恐我们变成坏人，”阿辽沙继续演讲，“可我们为什么一定会变成坏人，诸位，你们说对不？我们首先将是善良的，这一点最要紧，然后是正直的，然后——我们将彼此永不相忘。'],
    ['《一朵黄花》科塔萨尔', '“黄色的花……黄色是一种什么样的颜色？<br>有点忘记了。”', '“我看不到花。”', '那朵花很美，那是一朵美极了的花。而我却死定了，我会在某一天永远地死去。那朵花很漂亮，永远都会有漂亮的花给将来的人们看。突然，我明白了什么是虚无，我曾经以为那就是平静，是苦难的终结。我会死去，而卢克已经死了，再不会有一朵花留给像我们一样的人了，什么也不会有了，绝对不会有了，而虚无就是这样，就是再也不会有一朵花。'],
    ['《圣经·诗篇》22:1-19，和合本', '“求你……”', '“我们已经被神抛弃了。你，和我。”', '1 我的神，我的神！为什么离弃我？为什么远离不救我？不听我唉哼的言语？\n2 我的神啊，我白日呼求，你不应允；夜间呼求，并不住声。\n3 但你是圣洁的，是用以色列的赞美为宝座的。\n4 我们的祖宗倚靠你；他们倚靠你，你便解救他们。\n5 他们哀求你，便蒙解救；他们倚靠你，就不羞愧。\n6 但我是虫，不是人，被众人羞辱，被百姓藐视。\n7 凡看见我的都嗤笑我；他们撇嘴摇头，说：\n8 “他把自己交托耶和华，耶和华可以救他吧！耶和华既喜悦他，可以搭救他吧！”\n9 但你是叫我出母腹的；我在母怀里，你就使我有倚靠的心。\n10 我自出母胎就被交在你手里；从我母亲生我，你就是我的神。\n11 求你不要远离我！因为急难临近了，没有人帮助我。\n12 有许多公牛围绕我，巴珊大力的公牛四面困住我。\n13 它们向我张口，好像抓撕吼叫的狮子。\n14 我如水被倒出来；我的骨头都脱了节；我心在我里面如蜡熔化。\n15 我的精力枯干，如同瓦片；我的舌头贴在我牙床上。你将我安置在死地的尘土中。\n16 犬类围着我，恶党环绕我；他们扎了我的手，我的脚。\n17 我的骨头，我都能数过；他们瞪着眼看我。\n18 他们分我的外衣，为我的里衣拈阄。\n19 耶和华啊，求你不要远离我！我的救主啊，求你快来帮助我！'],
];

/**
 * ============================================================================
 * 4. 核心逻辑控制与状态更新引擎
 * ============================================================================
 */

function phase() {
    return state.rating < 30 ? 0 : state.rating < 70 ? 1 : state.rating < 100 ? 2 : 3;
}

function clamp() {
    for (let k of ['trust', 'nicole', 'mood', 'identity', 'rating']) {
        state[k] = Math.max(0, Math.min(100, state[k]));
    }
}

// 全局 UI 刷新引擎
function update() {
    clamp();
    
    $('#day').textContent = `DAY ${String(state.day).padStart(2, '0')} · ${['上午', '下午', '夜晚'][state.slot]}`;
    
    for (let k of ['trust', 'nicole', 'mood', 'rating']) {
        $('#' + k).textContent = state[k];
        $('#' + k + 'Bar')?.style.setProperty('width', state[k] + '%');
    }
    
    $('#points').textContent = state.points;
    
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
    
    $('#notice').textContent = warning;
    $('#notice').classList.toggle('urgent', urgent);
    
    // 渲染右侧主行动按钮
    renderActions();
}

function say(t) {
    $('#dialogue').innerHTML = '<p>' + t + '</p>';
}

function spend() {
    state.points--;
    if (state.points <= 0) {
        state.day++;
        state.slot = 0;
        state.points = 3;
    } else {
        state.slot++;
    }
    update();
}

function renderActions() {
    let locked = state.points <= 0;
    let arr = [
        ['实验/战斗', '提高Nicole浓度/实验进度', 'experiment'],
        ['对话', '了解Premier', 'chat'],
        ['阅读', '为Premier带书', 'book'],
        ['外出', '让Premier前往孤儿院广场草坪', 'walk']
    ];
    
    $('#actions').innerHTML = arr.map(a => 
        `<button class="action" ${locked ? 'disabled' : ''} data-a="${a[2]}">${a[0]}<small>${a[1]}</small></button>`
    ).join('');
}

function log(t) {
    state.logs.push(t);
    renderLogs();
}


/**
 * ============================================================================
 * 5. 核心互动行为分支处理
 * ============================================================================
 */

function updateVisuals(actionType) {
    if (actionType === 'walk') {
        $('#scene').style.backgroundImage = "url('lawn.png')";
    } else {
        $('#scene').style.backgroundImage = "url('lab.png')";
    }

    let p = phase();
    let version = (p <= 1) ? '1' : '2';

    let imgPrefix = 'experiment'; 
    if (actionType === 'chat') imgPrefix = 'talk';
    if (actionType === 'book') imgPrefix = 'read';
    if (actionType === 'walk') imgPrefix = 'out';

    $('#charImg').src = imgPrefix + version + '.png';
}

function act(a) {
    if (a !== 'book') { 
        updateVisuals(a);
    }
    
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
    
    if (a === 'chat') {
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
        let pool = talks[Math.min(3, phase())];
        say(pool[Math.floor(Math.random() * pool.length)]);
        spend();
    }
    
    if (a === 'book') {
        resetBookSelection(); 
        $('#bookModal').classList.remove('hidden'); 
    }
    
    if (a === 'walk') {
        if (state.rating === 100 && state.trust === 100 && state.nicole > 80 && state.identity > 50) {
            startFinal();
            return;
        }
        
        state.trust += 4;
        state.mood += 12;
        state.identity += 3;
        
        log('实验体进行外出观察，环境适应性良好。');
        if (state.rating >= 70) {
            const highRatingTalks = ['“外面起风了。”', '“外面的风，好冷。”', '“还能再见到他吗……”'];
            say(highRatingTalks[Math.floor(Math.random() * highRatingTalks.length)]);
        } else {
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

$('#saveLog').onclick = () => {
    let v = $('#logInput').value.trim() || '实验体今日情绪稳定。';
    state.logs.push(v);
    $('#logInput').value = '';
    $('#logModal').classList.add('hidden');
    say('“你写下了什么？”');
    spend();
};

$('#closeLog').onclick = () => {
    $('#logModal').classList.add('hidden');
    spend();
};

// ============ 新版 Win98 资源管理器选书逻辑 ============
let selectedBookIndex = null;

// 关闭选书面板并重置选中状态
$('#closeBook').onclick = () => {
    $('#bookModal').classList.add('hidden');
    resetBookSelection();
};

// 重置选书面板状态函数
function resetBookSelection() {
    selectedBookIndex = null;
    document.querySelectorAll('.book-item').forEach(item => item.classList.remove('selected'));
    $('#previewTitle').textContent = '请选择一本书';
    $('#previewDesc').textContent = '从左侧目录中单击选择一本书籍，即可在此查看其详细简介。';
    $('#confirmBook').setAttribute('disabled', 'true');
}

// 动态初始化书籍列表 HTML 节点
$('#bookList').innerHTML = books.map((b, i) => 
    `<button class="book-item" data-book="${i}">${b[0]}</button>`
).join('');

// 绑定书籍点击预览逻辑
document.querySelectorAll('[data-book]').forEach(b => {
    b.onclick = () => {
        document.querySelectorAll('.book-item').forEach(item => item.classList.remove('selected'));
        b.classList.add('selected');
        
        selectedBookIndex = parseInt(b.dataset.book);
        $('#previewTitle').textContent = books[selectedBookIndex][0];
        
        // --- 这里就是问题所在 ---
        // 将原来的 [2] 改为 [3]，即数组中的第四项（简介）
        $('#previewDesc').textContent = books[selectedBookIndex][3]; 
        
        $('#confirmBook').removeAttribute('disabled');
    };
});

// 绑定“确定选择”按钮点击事件
$('#confirmBook').onclick = () => {
    if (selectedBookIndex === null) return;
    
    let i = selectedBookIndex;
    let n = (state.bookUses[i] || 0) + 1; 
    state.bookUses[i] = n;
    
    updateVisuals('book');
    
    state.trust += 5;
    state.identity += 7;
    state.mood += 8;
    
    $('#bookModal').classList.add('hidden');
    
    // --- 核心修改：分阶段对话逻辑 ---
    let finalDialogue;
    
    if (n >= 10) {
        finalDialogue = '“谢谢。”';
    } else if (n >= 5) {
        finalDialogue = '“重复的……”';
    } else {
        // 根据阶段判断：0,1为前期(索引1)，2,3为后期(索引2)
        // 数组结构: [标题(0), 前期对话(1), 后期对话(2), 简介(3)]
        finalDialogue = books[i][phase() >= 2 ? 2 : 1];
    }
    
    say(finalDialogue);
    
    resetBookSelection();
    spend();
};

/**
 * ============================================================================
 * 7. 结局剧本（Final Act）文字轮播器与高潮结算
 * ============================================================================
 */

function startFinal() {
    state.final = true;
    $('#finalModal').classList.remove('hidden');
    $('#finalModal').classList.add('final'); 

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
            setTimeout(() => typeWriter(text, i + 1, element, callback), 50);
        } else {
            callback(); 
        }
    }

    function next() {
        if (ix < lines.length) {
            const el = $('#finalText');
            typeWriter(lines[ix], 0, el, () => {
                if (lines[ix].includes('今天也要开始吗？')) {
                    $('#finalButton').classList.remove('hidden');
                } else {
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

$('#finalButton').onclick = () => {
    bgm.pause();           
    bgm.src = 'final.mp3'; 
    bgm.play();            

    let el = $('#finalText');
    $('#finalButton').classList.add('hidden');
    
    document.body.classList.add('escape');
    $('#scene').classList.add('escape');
    
    function typeWriter(text, i, element, callback) {
        if (i < text.length) {
            element.textContent = text.substring(0, i + 1);
            setTimeout(() => typeWriter(text, i + 1, element, callback), 30); 
        } else if (callback) {
            callback();
        }
    }

    typeWriter('NICOLE 完成度：100%\n\n警报声穿过整栋研究所。\n\n黑暗中，有人惨叫。随后是枪声。', 0, el, () => {
        setTimeout(() => {
            typeWriter('实验室门开了。\n\nPremier 浑身是血，平静地走向你。\n\n“……Emma。”', 0, el, () => {
                setTimeout(() => {
                    typeWriter('剧痛。\n\n你的左臂落在血泊里。\n\nPremier 站在燃烧的门口，回头看了你一眼。\n\n“一切都是……预定调和。”\n\n他离开了。\n\n—— NICOLE PREMIER · END ——', 0, el);
                }, 2000); 
            });
        }, 2000); 
    });
};


/**
 * ============================================================================
 * 8. 全局事件委托与游戏激活
 * ============================================================================
 */

document.addEventListener('click', e => {
    const targetButton = e.target.closest('[data-a]');
    if (targetButton && !targetButton.hasAttribute('disabled')) {
        act(targetButton.dataset.a);
    }
});


// 音频播放逻辑
const bgm = new Audio('bgm.mp3'); 
bgm.loop = true;
let musicStarted = false;

function startMusic() {
    if (!musicStarted) {
        bgm.volume = 0.5;
        bgm.play().then(() => {
            musicStarted = true;
            document.removeEventListener('click', startMusic);
        }).catch(e => {
            console.log("音频播放被浏览器拦截，请再次点击页面。", e);
        });
    }
}
document.addEventListener('click', startMusic);


// ============================================
// 游戏首次加载时自动执行首次初始化（务必保留在最末尾）
// ============================================
update();
