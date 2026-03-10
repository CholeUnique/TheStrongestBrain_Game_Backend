//《箭阵迷域》游戏逻辑

// 游戏规则：
// 1. 盘面中分布着众多不同指向的弓箭旋钮，触发并激活下一个旋钮后该弓箭会消失，若碰到盘壁直接消失。
// 2. 用户需要找出能一次激活所有弓箭旋钮的那个旋钮（可选择盘面中任意一个旋钮为起点），若激活后盘面中仍有剩余旋钮，则失败。
// 3. 弓箭旋钮可选择指向8个方向，但每个旋钮最多两个方向。

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

const SCORE_RULES = [
  { threshold: 300, score: 20 },  // 5分钟
  { threshold: 600, score: 10 },  // 10分钟
  { threshold: 1200, score: 5 },  // 20分钟
  { threshold: Infinity, score: 0 }
];

router.get('/puzzle', authenticateToken, (req, res) => {
    // 使用 SQL 的 RANDOM() 函数随机选择一行数据
    // 如果是 MySQL 请使用 ORDER BY RAND()
    const sql = `SELECT id, size, nodes_data,correct_start FROM arrow_puzzles ORDER BY RANDOM() LIMIT 1`;

    db.get(sql, [], (err, row) => {
        if (err) {
            console.error("数据库查询错误:", err.message);
            return res.status(500).json({ error: "题库读取失败" });
        }

        if (!row) {
            return res.status(404).json({ error: "题库中暂无题目，请联系管理员添加" });
        }
        
        // 返回题目数据
        res.json({
            puzzleId: row.id,
            size: row.size,
            nodes_data: row.nodes_data, // 注意：数据库存的是 JSON 字符串，前端会解析
            correct_start: row.correct_start // 正确的起点
        });
    });
});

router.post('/verify', authenticateToken, (req, res) => {
    const { isAllCleared, timeSpent, puzzleId } = req.body;
    const userId = req.user.userId;

    // 1. 基础逻辑：只要提交了，游戏次数就要增加（recordGameResult 内部通常已处理）
    if (!isAllCleared) {
        // 失败：0分，记录挑战次数
        recordGameResult(userId, 'arrow-maze', 3, false, timeSpent, 0);
        return res.json({ isWin: false, score: 0, message: '未完全清空，再接再厉！' });
    }

    // 2. 更加优雅的分值计算逻辑 (自动匹配阶梯)
        const matchedRule = SCORE_RULES.find(rule => timeSpent <= rule.threshold);
        const score = matchedRule ? matchedRule.score : 0;

    // 3. 写入数据库：更新总分、总次数、胜率等
    recordGameResult(userId, 'arrow-maze', 3, true, timeSpent, score);

    res.json({ 
            isWin: true, 
            score: score, 
            timeRank: score === 20 ? 'S' : score === 10 ? 'A' : score === 5 ? 'B' : 'C',
            message: score > 0 ? `完美清除！获得 ${score} 积分` : "成功清除，但用时过长未获得积分"
        });
        
});


module.exports = router;