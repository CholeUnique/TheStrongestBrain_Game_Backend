//数据库连接及建表

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('数据库连接失败:', err.message);
  else console.log('✅ 已连接到 SQLite 数据库。');
});

db.serialize(() => {
    // 创建《生命游戏》库表 
    db.run(`CREATE TABLE IF NOT EXISTS puzzles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        difficulty INTEGER, 
        rows INTEGER, 
        cols INTEGER, 
        initial_grid TEXT, 
        solution_grid TEXT
    )`);

    // 创建用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_id TEXT UNIQUE,     -- 系统唯一ID (不可改)
        nickname TEXT,             -- 昵称
        password TEXT,             -- 加密后的密码
        avatar TEXT,               -- 头像URL
        bio TEXT,                  -- 简介
        score INTEGER DEFAULT 0,   -- 积分
        badges TEXT,               -- 徽章 (存JSON数组)
        gender TEXT DEFAULT '保密', -- 性别
        birthday TEXT DEFAULT '',  -- 生日
        radar_stats TEXT,           -- 雷达图数据 (存JSON)
        unlocked_badges TEXT DEFAULT '["🌱", "🔥", "🧊", "👑"]' -- 已解锁的徽章 (存JSON数组)
    )`);

    // 游戏流水表
    db.run(`CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        game_id TEXT, 
        difficulty INTEGER, 
        is_win BOOLEAN, 
        time_spent INTEGER,  -- 耗时(秒)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 核心全局统计表
    db.run(`CREATE TABLE IF NOT EXISTS user_stats(
        user_id INTEGER PRIMARY KEY,            -- 绑定 users 表的 id
        sum_time_spent INTEGER DEFAULT 0,       -- 总游戏耗时 (秒)
        month_time_spent TEXT DEFAULT '{}',     -- 周/月耗时字典 (存 JSON，例如: {"2026-W10": 1500})
        day_time_spent TEXT DEFAULT '{}',       -- 日耗时字典 (存 JSON，用于生成140天热力图: {"2026-03-05": 120})
        single_time_spent INTEGER DEFAULT 0,    -- 今日单日耗时 (秒)
        last_play_date TEXT DEFAULT '',         -- 记录上次游玩日期 (YYYY-MM-DD)，用于跨天重置
        sum_num_of_game INTEGER DEFAULT 0,      -- 总游戏次数
        win_num_of_game INTEGER DEFAULT 0,      -- 胜利游戏次数
        win_rate REAL DEFAULT 0.0               -- 胜率 (胜利次数/总次数)
    )`);

    //《精准造字》题库表
    db.run(`CREATE TABLE IF NOT EXISTS word_puzzles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grid_components TEXT,       -- 6x6的字根盘面 (一维数组，长度36)
        radical_pool TEXT,          -- 6个可选部首 (数组)
        valid_combinations TEXT     -- 字典映射：{"石+页":"硕", "广+坐":"座"...} 用于后端校验
    )`, () => {
        // 插入一道测试用的初始题目 (对照你截图的灵感)
        db.get("SELECT * FROM word_puzzles WHERE id = 1", (err, row) => {
            if (!row) {
                const testGrid = [
                    "寸", "元", "爻", "及", "专", "员",
                    "聿", "区", "示", "加", "奴", "朱",
                    "艮", "皮", "牛", "工", "木", "切",
                    "寺", "云", "勺", "斤", "刂", "央",
                    "也", "欠", "单", "走", "户", "直",
                    "屯", "韦", "干", "交", "史", "火"
                ];
                const testRadicals = ["马", "车", "歹", "彳", "纟", "宀"];
                const validCombos = {
                    // 🐎 马字旁
                    "马+区": "驱", "马+加": "驾", "马+奴": "驽", 
                    "马+也": "驰", "马+爻": "驳", "马+史": "驶",
                    "马+户": "驴",

                    // 🚗 车字旁
                    "车+专": "转", "车+斤": "斩", "车+欠": "软", 
                    "车+干": "轩", "车+交": "较",

                    // ☠️ 歹字旁 (残字旁)
                    "歹+员": "殒", "歹+朱": "殊", "歹+刂": "列", 
                    "歹+央": "殃", "歹+单": "殚", "歹+直": "殖",

                    // 🚶 彳 (双人旁)
                    "彳+聿": "律", "彳+艮": "很", "彳+皮": "彼", 
                    "彳+切": "彻", "彳+寺": "待", "彳+走": "徒",
                   

                    // 🧵 纟 (绞丝旁)
                    "纟+寸": "纣", "纟+及": "级", "纟+工": "红", 
                    "纟+云": "纭", "纟+勺": "约", "纟+屯": "纯", 
                    "纟+韦": "纬", "纟+交": "绞",

                    // 🏠 宀 (宝盖头) - 考察上下结构
                    "宀+寸": "守", "宀+元": "完", "宀+示": "宗", 
                    "宀+牛": "牢", "宀+木": "宋", "宀+火": "灾"
                };
                
                db.run(`INSERT INTO word_puzzles (grid_components, radical_pool, valid_combinations) VALUES (?, ?, ?)`,
                    [JSON.stringify(testGrid), JSON.stringify(testRadicals), JSON.stringify(validCombos)]
                );
            }
        });
    });

    //《箭阵迷域》游戏表
    db.run(`CREATE TABLE IF NOT EXISTS arrow_puzzles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        size INTEGER DEFAULT 8,        -- 盘面尺寸，如 8 代表 8x8
        nodes_data TEXT,               -- 存储所有旋钮的 JSON：[{id, x, y, dirs:['N','E']}]
        correct_start TEXT             -- 预设的唯一正确起点坐标，如 "E6"
    )`);


});

module.exports = db;