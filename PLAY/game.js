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
        '“可以帮我收好这把刀吗。”',
        '“没有视物的眼睛，也没有说话嘴巴……”',
        '“还有其他孩子吗？”'
    ],
    [
        '“我今天一直在等你。我想，和你说话。”',
        '“今天有带书来吗？”',
        '“你的手，好温暖。”',
        '“我刻下了愿望。”',
        '“伤口有些痒。”',
        '“明天还会是你来吗？”'
    ],
    [
        '“我会遵守命令。”',
        '“这是不被允许的。”',
        '“不必要的感情。”',
        '“你的手有点冷”',
        '“你在动摇。”',
        '“我不应当拥有……”',
        '“是什么让你犹豫？”'
    ],
    [
        '“黑色以外的色彩，不存在……”',
        '“消毒水浸泡的河鱼……”',
        '“好安静。”',
        '“无法改变。”',
        '“мама……”'
    ]
];

// 结构：[书名, 前期对话(phase<2), 后期对话(phase>=2), 简介]
const books = [
    ['《帆》莱蒙托夫', '“……海？<br>……我可以，「想要看海」吗？”', '“一切终将归于……风暴。”', '在那大海上淡蓝色的云雾里，\n有一片孤帆儿在闪耀着白光！\n它寻求着什么，在遥远的异地？\n它抛下什么，在可爱的故乡？\n\n波涛在汹涌海风在呼啸，\n桅杆在弓起了腰轧轧地作响……\n唉！它不是在寻求什么幸福，\n也不是逃避幸福而奔向他方！\n\n下面是比蓝天还清澄的大海，\n上面是金黄色灿烂的太阳……\n而它，不安的，在祈求风暴，\n仿佛是在风暴中才有着安详！'],
    ['《婚约》洛尔迦', '“一直在等待吗？”', '“百年的……生命。<br>悲哀。”', '从水里捞起\n这个金指箍。\n\n（阴影把它的手指\n按住了我的肩窝。）\n\n把这金箍捞起，我的年纪\n早已过了百岁。静些！\n\n一句话也别问我！\n\n从水里捞起\n这个金指箍。'],
    ['《数数杏仁（无题）》保罗·策兰', '“妈妈。爸爸……邻人。街道上的陌生人。<br>请问，哪里可以拿到杏仁？”', '“我也是……苦杏仁吗？”', '数数杏仁， \n数数苦的让你醒着的， \n把我也数进去： \n我寻找你的眼睛， \n你睁开无人看你， \n我纺那秘密的线 \n你在线上的沉思之露 \n落进被不能打动人心的词语 \n守护的水罐中。 \n\n你全部进入的名字才是你的， \n坚定地走向你自己， \n锤子在你沉默的钟楼自由摆动， \n无意中听见的够到你， \n死者也用双臂搂住你， \n你们三人步入夜晚。 \n\n让我变苦。 \n把我数进杏仁中。'],
    ['《假面的告白》三岛由纪夫', '“二十多岁以后的人是什么样的？<br>会穿上白衣服吧，就像这里的人一样。”', '“将来是不存在的。”', '战争教会我们奇妙的、感伤的成长方法。那就是到了二十多岁就打算斩断人生，然后一概不考虑将来怎样。人生对于我们来说，轻飘飘得不可思议。'],
    ['《卡拉马佐夫兄弟》陀思妥耶夫斯基', '“……我会变成坏人吗？”', '“……我们将彼此永不相忘。”', '我这样说只是唯恐我们变成坏人，”阿辽沙继续演讲，“可我们为什么一定会变成坏人，诸位，你们说对不？我们首先将是善良的，这一点最要紧，然后是正直的，然后——我们将彼此永不相忘。'],
    ['《被侮辱与被损害的》陀思妥耶夫斯基', '“活着……就能获得幸福吗？<br>我在想……我在想了。”', '“我尽力了。”', '首要的事情就是要活着，其次要永远保持健康，这样就能获得人生的幸福。我可爱的孩子，要是您有什么伤心的事，那么就忘掉它，最好是竭力不去想它。要是您没有什么伤心的事，那么……也别去想它，而是要竭力去想开心的事……想那轻松愉快的事……'],
    ['《一朵黄花》科塔萨尔', '“黄色的花……黄色是一种什么样的颜色？<br>有点忘记了。”', '“我看不到花。”', '那朵花很美，那是一朵美极了的花。而我却死定了，我会在某一天永远地死去。那朵花很漂亮，永远都会有漂亮的花给将来的人们看。突然，我明白了什么是虚无，我曾经以为那就是平静，是苦难的终结。我会死去，而卢克已经死了，再不会有一朵花留给像我们一样的人了，什么也不会有了，绝对不会有了，而虚无就是这样，就是再也不会有一朵花。'],
    ['《圣经·诗篇》22:1-19，和合本', '“求你……”', '“我们已经被神抛弃了。你，和我。”', '1 我的神，我的神！为什么离弃我？为什么远离不救我？不听我唉哼的言语？\n2 我的神啊，我白日呼求，你不应允；夜间呼求，并不住声。\n3 但你是圣洁的，是用以色列的赞美为宝座的。\n4 我们的祖宗倚靠你；他们倚靠你，你便解救他们。\n5 他们哀求你，便蒙解救；他们倚靠你，就不羞愧。\n6 但我是虫，不是人，被众人羞辱，被百姓藐视。\n7 凡看见我的都嗤笑我；他们撇嘴摇头，说：\n8 “他把自己交托耶和华，耶和华可以救他吧！耶和华既喜悦他，可以搭救他吧！”\n9 但你是叫我出母腹的；我在母怀里，你就使我有倚靠的心。\n10 我自出母胎就被交在你手里；从我母亲生我，你就是我的神。\n11 求你不要远离我！因为急难临近了，没有人帮助我。\n12 有许多公牛围绕我，巴珊大力的公牛四面困住我。\n13 它们向我张口，好像抓撕吼叫的狮子。\n14 我如水被倒出来；我的骨头都脱了节；我心在我里面如蜡熔化。\n15 我的精力枯干，如同瓦片；我的舌头贴在我牙床上。你将我安置在死地的尘土中。\n16 犬类围着我，恶党环绕我；他们扎了我的手，我的脚。\n17 我的骨头，我都能数过；他们瞪着眼看我。\n18 他们分我的外衣，为我的里衣拈阄。\n19 耶和华啊，求你不要远离我！我的救主啊，求你快来帮助我！'],
    ['《海的女儿》安徒生', '“小美人鱼为什么要放弃呢？但是……真是美丽啊。<br>嗯？「美丽」是什么……？”', '“如果这样可以让那个人幸福的话。”', '在那条船上，人声和活动又开始了。她看到王子和他美丽的新娘在寻找她。他们悲悼地望着那翻腾的泡沫，好像他们知道她已经跳到浪涛里去了似的。在冥冥中她吻着这位新嫁娘的前额，她对王子微笑。于是她就跟其他的空气中的孩子们一道，骑上玫瑰色的云块，升入天空里去了。'],
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
        ['阅读', '私下为Premier带书', 'book'],
        ['外出', '让Premier前往孤儿院草坪', 'walk']
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
        
    
        log(state.nicole > 65 ? '战斗数据已记录。' : '今日实验顺利，Premier生命体征稳定。');
        if (state.rating >= 70) {
            const highRatingTalks = ['“我会的。”', '“……”', '“……不要看我。”', '“……生命。”', '“这双手，已经……”', '“我想清洁……”'];
            say(highRatingTalks[Math.floor(Math.random() * highRatingTalks.length)]);
        } else {
            const lowRatingTalks = ['“必须去吗？”', '“有些疼。”', '“我不想进食……”', '“你可以陪着我吗？”', '“我不想有太多人……”'];
            say(lowRatingTalks[Math.floor(Math.random() * lowRatingTalks.length)]);
        }
        spend();
    }
    
    if (a === 'chat') {
        if (state.mood < 18) {
            log('实验体拒绝语言交流。');
            say('“（沉默）”');
            spend();
            return;
        }
        
        state.trust += 6;
        state.mood += 4;
        state.identity += 5;
        
        log('Premier语言功能正常，交流数据已收集。');
        let pool = talks[Math.min(3, phase())];
        say(pool[Math.floor(Math.random() * pool.length)]);
        spend();
    }
    
    if (a === 'book') {
        resetBookSelection(); 
        $('#bookModal').classList.remove('hidden'); 
    }
    
    if (a === 'walk') {
        if (state.rating === 100 && state.trust >= 80 && state.nicole === 100 && state.identity >= 50) {
            startFinal();
            return;
        }
        
        state.trust += 4;
        state.mood += 12;
        state.identity += 2;
        
        log('Premier已进行外出观察，环境适应性良好。');
        if (state.rating >= 70) {
            const highRatingTalks = ['“外面起风了。”', '“外面的风，好冷。”', '“落叶……”', '“好昏暗……”', '“还能再见到他吗……”'];
            say(highRatingTalks[Math.floor(Math.random() * highRatingTalks.length)]);
        } else {
            const lowRatingTalks = ['“太阳，好温暖。”', '“草坪上很舒服。”', '“树很好闻。”', '“光斑、在晃动。”', '“长了新芽。”', '“蓝色、天空、眼睛……”','“我看见了其他孩子。”'];
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
    state.identity += 5;
    state.mood += 8;
    
    $('#bookModal').classList.add('hidden');
    
    // --- 核心修改：分阶段对话逻辑 ---
    let finalDialogue;
    
    if (n >= 15) {
        finalDialogue = '“不需要了。”';
    } else if (n >= 12) {
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
        `“最后一次外出吗。”\n今天是个难得的晴天，\nn触碰着树木的纹路，想起了那个少年。`,
        `回到实验室后，n躺在床上，等待宣判。\n但，听见了研究员的话语。`,
        `“感情测试很成功。”\n“Emma真是好女人，Premier都沦陷了！”\n“亲密接触的实验。数据都很好哦。”`,
        `Premier躺在手术台上，\n似乎比以往更阴沉。\n没有感情的兵器也会哀悼吗？\n\n【是否进行最终实验？】`
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
                if (lines[ix].includes('【是否进行最终实验？】')) {
                    $('#finalButton').classList.remove('hidden');
                } else {
                    setTimeout(() => {
                        ix++;
                        next();
                    }, 3000);
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
    
    // 扩展版打字机函数
    function typeWriter(text, i, element, callback) {
        if (i < text.length) {
            element.textContent = text.substring(0, i + 1);
            setTimeout(() => typeWriter(text, i + 1, element, callback), 30); 
        } else if (callback) {
            callback();
        }
    }

    // --- 结局分支 1：常规结局 (收容失效) ---
    function triggerNormalEnding() {
        document.body.classList.add('escape');
        $('#scene').classList.add('escape');
        
        typeWriter('警报声穿过整栋研究所，\n红色的警示灯闪烁着，\n惨叫、枪声、血肉的声音在走廊中迸发。', 0, el, () => {
            setTimeout(() => {
                typeWriter('门开了。\nPremier浑身是血，平静地走向你。\n“……Emma。”', 0, el, () => {
                    setTimeout(() => {
                        typeWriter('没有更多话语。\n你的左臂落在血泊里。\nPremier背对着闪烁的红光。', 0, el, () => {
                            setTimeout(() => {
                                typeWriter('“一切都是……预定调和。”\n他离开了。\n\n—— NICOLE PREMIER · NORMAL END ——', 0, el);
                            }, 3000); 
                        });
                    }, 3000);
                });
            }, 3000);
        });
    }

    // --- 结局分支 2：隐藏结局 (前往草坪) ---
    function triggerHiddenEnding() {
        // ========== 核心修改：切换真结局 BGM ==========
        bgm.pause();
        bgm.src = 'trueend.mp3';
        bgm.play().catch(e => console.log("BGM播放被拦截", e));
        // ===============================================

        typeWriter('解决掉了必要的防卫后，\nnano并没有逃出正门，\n而是穿过侧门进入草坪。', 0, el, () => {
            setTimeout(() => {
                typeWriter('nano回忆着孤儿院的小路\n左臂已经被血液浸透，滴在草坪上，\n重叠的草木间，那名少年坐在长椅上。', 0, el, () => {
                    setTimeout(() => {
                        typeWriter('似乎闻到了突兀的血腥味，少年望向nano的方向。\n他有些被nano吓到，动作有些僵硬，\n但并没有逃走。', 0, el, () => {
                            setTimeout(() => {
                                typeWriter('血液依然沿着手臂滴落，nano向着少年伸出手，\n“你还愿意，握住这手吗？”\n\n—— NICOLE PREMIER · TRUE END ——', 0, el);
                            }, 3000); 
                        });
                    }, 3000);
                });
            }, 3000);
        });
    }

    // ============================================
    // 逻辑分流：先校验条件，再决定播放剧情
    // ============================================
    const isTrueEnd = state.rating === 100 && state.trust === 100 && state.nicole === 100 && state.identity === 100;
    const isNormalEnd = state.rating === 100 && state.trust >= 80 && state.nicole === 100 && state.identity >= 50;

    if (isTrueEnd) {
        // 只有在完美达成隐藏结局条件时，才播放询问分支的占位剧情
        const placeholderStory = "警报声穿过研究所，Premier逃脱了。\n\n是要封锁实验室，拖住Premier的脚步，\n还是置之不理，放Premier自由？\n";
        
        typeWriter(placeholderStory, 0, el, () => {
            const buttonsHtml = `
                <div style="margin-top: 40px; display: flex; justify-content: center; gap: 30px;">
                    <button id="btnLawn" class="primary" style="position: static; font-size: 16px; padding: 10px 20px; cursor: pointer; pointer-events: auto;">不封锁</button>
                    <button id="btnLockdown" class="primary" style="position: static; font-size: 16px; padding: 10px 20px; cursor: pointer; pointer-events: auto;">封锁</button>
                </div>
            `;
            el.innerHTML = el.textContent + buttonsHtml;

            // 绑定事件
            document.getElementById('btnLawn').onclick = () => { triggerHiddenEnding(); };
            document.getElementById('btnLockdown').onclick = () => { triggerNormalEnding(); };
        });
    } else {
        // 否则（常规结局或其他情况），直接跳过占位文本，直接进入常规结局流程
        triggerNormalEnding();
    }
};

/**
 * ============================================================================
 * 8. 全局事件委托与音频控制
 * ============================================================================
 */

// 核心修复：重新绑定全局行动按钮点击委托（使“实验”“对话”“阅读”“外出”等恢复响应）
document.addEventListener('click', e => {
    const targetButton = e.target.closest('[data-a]');
    if (targetButton && !targetButton.hasAttribute('disabled')) {
        act(targetButton.dataset.a);
    }
});

// 全局音频播放逻辑
const bgm = new Audio('bgm.mp3'); 
bgm.loop = true;
let musicStarted = false;

function startMusic() {
    if (!musicStarted) {
        bgm.volume = 0.5;
        bgm.play().then(() => {
            musicStarted = true;
        }).catch(e => {
            console.log("音频播放被浏览器拦截", e);
        });
    }
}

/**
 * ============================================================================
 * 9. 启动界面与图片素材预加载
 * ============================================================================
 */
// 需要预加载的游戏核心素材
const assetsToLoad = [
    'experiment1.png', 'experiment2.png',
    'talk1.png', 'talk2.png',
    'read1.png', 'read2.png',
    'out1.png', 'out2.png',
    'lab.png', 'lawn.png',
    'logo.png' 
];
let loadedCount = 0;

function checkLoadComplete() {
    loadedCount++;
    // 当所有资源加载完毕，显示“登入”按钮
    if (loadedCount >= assetsToLoad.length) {
        $('#loadingStatus').classList.add('hidden');
        $('#startGameBtn').classList.remove('hidden');
    }
}

// 遍历加载素材（带容错处理）
assetsToLoad.forEach(src => {
    const img = new Image();
    img.onload = checkLoadComplete;
    // 如果图片暂时不存在，也强行算作加载完成，防止死锁卡屏
    img.onerror = checkLoadComplete; 
    img.src = src;
});

// 点击“登入ENED系统”按钮：关闭启动遮罩，播放音乐并渲染主界面
$('#startGameBtn').onclick = () => {
    $('#startupScreen').classList.add('hidden');
    startMusic();
    update(); // 初始化渲染主界面并生成“实验”“对话”等动态按钮
};

/**
 * ============================================================================
 * 10. 设置弹窗与帮助菜单逻辑
 * ============================================================================
 */
// 打开设置弹窗
$('#settingsBtn').onclick = () => {
    $('#settingsModal').classList.remove('hidden');
};

// 关闭设置弹窗
$('#closeSettings').onclick = () => {
    $('#settingsModal').classList.add('hidden');
    $('#helpContent').classList.add('hidden'); // 关闭时折叠帮助文本
};

// 静音按钮切换
$('#muteBtn').onclick = () => {
    bgm.muted = !bgm.muted;
    $('#muteBtn').textContent = bgm.muted ? '取消静音' : '静音 BGM';
};

// 帮助按钮文本折叠展示
$('#helpBtn').onclick = () => {
    $('#helpContent').classList.toggle('hidden');
};