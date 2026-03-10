//《精准造字PreciseWord》游戏逻辑

// 游戏规则：

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

router.get('/generate',authenticateToken,(req,res)=>{
    db.get(`SELECT * FROM word_puzzles ORDER BY RANDOM() LIMIT 1`, (err, row) => {
        if (err || !row) return res.status(500).json({ error: '题库为空或查询失败' });
        res.json({
            puzzleId: row.id,
            gridComponents: JSON.parse(row.grid_components),
            radicalPool: JSON.parse(row.radical_pool),
            // 注意：绝对不要把 valid_combinations 发给前端，防止玩家作弊！
            validCombinations: JSON.parse(row.valid_combinations)
        });
    });
})

router.post('/verify',authenticateToken,(req,res)=>{
    const userId = req.user.userId;
    const { puzzleId, isSurrender, timeSpent } = req.body; 
    
    // 如果是投降，直接算输
    if (isSurrender) {
        recordGameResult(userId, 'precise-word', 3, false, timeSpent, 0);
        return res.json({ isCorrect: false, message: '已投降，计入败绩' });
    }

    // 如果通关了，计算得分 (单位：秒)
    let finalScore = 5; // 超过20分钟默认 5 分
    if (timeSpent <= 600) {
        finalScore = 20; // 小于等于10分钟 (600秒)
    } else if (timeSpent <= 1200) {
        finalScore = 10; // 10到20分钟 (1200秒)
    }

    // 记录通关数据
    recordGameResult(userId, 'precise-word', 3, true, timeSpent, finalScore);
    
    res.json({
        isCorrect: true,
        scoreEarned: finalScore,
        message: `🎉 造字成功！耗时 ${Math.floor(timeSpent/60)}分${timeSpent%60}秒，获得 ${finalScore} 积分！`
    });
});

module.exports = router;