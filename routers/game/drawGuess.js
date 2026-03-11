//《你画我猜》游戏逻辑

const drawGuessTopics = [
  // 日常物品
  "杯子", "雨伞", "书包", "钥匙", "眼镜", "闹钟", "牙刷", "毛巾", "拖鞋", "梳子", 
  "镜子", "剪刀", "铅笔", "笔记本", "台灯", "筷子", "勺子", "钱包", "充电宝",
  // 动物
  "熊猫", "老虎", "兔子", "小狗", "小猫", "大象", "猴子", "长颈鹿", "斑马", "狮子", 
  "企鹅", "章鱼", "鲸鱼", "海豚", "蝴蝶", "蜜蜂", "小鸟", "蛇", "乌龟", "青蛙",
  // 植物
  "玫瑰", "向日葵", "荷花", "仙人掌", "多肉", "松树", "柳树", "竹子", "苹果", "香蕉", 
  "橙子", "草莓", "西瓜", "胡萝卜", "青菜",
  // 交通工具
  "汽车", "火车", "飞机", "自行车", "电动车", "轮船", "公交车", "地铁", "摩托车", "火箭", 
  "直升机", "小船", "货车", "出租车", "热气球",
  // 食物
  "米饭", "汉堡", "火锅", "冰淇淋", "蛋糕", "披萨", "面条", "面包", "薯条", "炸鸡", 
  "寿司", "烤肉", "奶茶", "可乐", "糖果",
  // 娱乐休闲
  "篮球", "足球", "羽毛球", "吉他", "钢琴", "书籍", "电影票", "拼图", "积木", "风筝",
  // 职业
  "医生", "老师", "警察", "消防员", "护士", "厨师", "画家", "歌手", "司机", "科学家",
  // 自然现象
  "彩虹", "下雨", "下雪", "闪电", "太阳", "月亮", "星星", "云朵",
  // 电子产品
  "手机", "电脑", "电视", "耳机", "相机", "平板", "游戏机",
  // 其他
  "房子", "大树", "桥梁", "路灯", "红绿灯", "帽子", "鞋子", "衣服", "手套",
  // 补充题目
  "滑梯", "秋千", "气球", "蜡烛", "礼物", "信封", "邮票", "望远镜", "放大镜"
];

let gameState = {
    currentWord: "",
    winRounds: 0,      // 赢的轮数
    totalRounds: 0,    // 总轮数
    startTime: null,   // 用于记录总花费时间
    players: {}        // 记录在线玩家 { socketId: userId }
};

const getRandomTopic = () => {
    return drawGuessTopics[Math.floor(Math.random() * drawGuessTopics.length)];
};

module.exports = (io) => {
  // 初始化第一局
  gameState.currentWord = getRandomTopic();
  gameState.startTime = Date.now();
  gameState.totalRounds = 1;

  io.on('connection', (socket) => {
    socket.on('join-game', (userId) => {
        gameState.players[socket.id] = userId;
        console.log(`玩家 ${userId} 加入，当前总赢数: ${gameState.winRounds}`);
        
        // 同步当前进度给新玩家
        socket.emit('init-game', {
            word: gameState.currentWord,
            winRounds: gameState.winRounds,
            totalRounds: gameState.totalRounds,
            startTime: gameState.startTime
        });
    });
    // 轨迹同步
    socket.on('draw-line', (data) => socket.broadcast.emit('draw-line', data));
    socket.on('clear-canvas', () => socket.broadcast.emit('clear-canvas'));

    // 猜题逻辑 (协作模式：一人对，全队赢)
    socket.on('submit-guess', (guess) => {
        if (guess.trim() === gameState.currentWord) {
            gameState.winRounds += 1;
            gameState.totalRounds += 1;
            const nextWord = getRandomTopic();
            gameState.currentWord = nextWord;

            // 计算当前总耗时（秒）
            const timeSpent = Math.floor((Date.now() - gameState.startTime) / 1000);

            // 全场同步更新
            io.emit('round-success', {
                winnerId: gameState.players[socket.id],
                winRounds: gameState.winRounds,
                totalRounds: gameState.totalRounds,
                nextWord: nextWord,
                timeSpent: timeSpent,
                msg: `🎉 猜对了！答案是 [${guess}]`
            });
        }
    });

    // 跳过题目 (算作输了一轮)
    socket.on('skip-word', () => {
        gameState.totalRounds += 1; // 输了两人一起不加分，但总轮数加1
        const nextWord = getRandomTopic();
        gameState.currentWord = nextWord;
        
        io.emit('round-skip', {
            totalRounds: gameState.totalRounds,
            nextWord: nextWord,
            msg: "这题太难了，跳过！"
        });
    });

    socket.on('disconnect', () => {
        console.log('玩家',socket.id,'退出你画我猜');
        delete gameState.players[socket.id];
    });

    // 清空画板
    socket.on('clear-canvas', () => {
      socket.broadcast.emit('clear-canvas');
    });

  
  });
};