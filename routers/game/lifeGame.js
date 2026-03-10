// 《生命游戏LifeGame》游戏逻辑
// 游戏规则：
// 1. 任何活着的细胞，在周围有少于2个或多于3个活着的细胞时，都会死亡。
// 2. 任何死细胞，在周围有恰好3个活着的细胞时，会变成活着的细胞（繁殖）。

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

const getNextGeneration = (grid, rows, cols) => {
  const nextGrid = grid.map(arr => [...arr]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let neighbors = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const nr = r + i, nc = c + j;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) neighbors += grid[nr][nc];
        }
      }
      if (grid[r][c] === 1 && (neighbors < 2 || neighbors > 3)) nextGrid[r][c] = 0;
      else if (grid[r][c] === 0 && neighbors === 3) nextGrid[r][c] = 1;
    }
  }
  return nextGrid;
};

// 这里的路径变成了 /generate (在 index 中会挂载到 /api/life-game/generate)
router.post('/generate', authenticateToken, (req, res) => {
  const { difficulty } = req.body;
  const rows = 15, cols = difficulty * 10;
  const initialGrid = Array(rows).fill().map(() => Array(cols).fill().map(() => (Math.random() > 0.8 ? 1 : 0)));
  
  let current = initialGrid, next = getNextGeneration(current, rows, cols), iterations = 0;
  while (JSON.stringify(current) !== JSON.stringify(next) && iterations < 70) {
    current = next; next = getNextGeneration(current, rows, cols); iterations++;
  }
  const solutionGrid = current;

  db.run(`INSERT INTO puzzles (difficulty, rows, cols, initial_grid, solution_grid) VALUES (?, ?, ?, ?, ?)`,
    [difficulty, rows, cols, JSON.stringify(initialGrid), JSON.stringify(solutionGrid)],
    function(err) {
      if (err) return res.status(500).json({ error: '题目生成失败，请检查数据库状态' });
      res.json({ puzzleId: this.lastID, initialGrid, rows, cols, message: '题目生成成功！' });
    }
  );
});

router.post('/verify', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { puzzleId, playerGrid, difficulty, gameId, timeSpent } = req.body; 
  if (!puzzleId) return res.status(400).json({ error: '提交失败：前端传过来的 puzzleId 是空的！' });

  db.get(`SELECT solution_grid FROM puzzles WHERE id = ?`, [puzzleId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '找不到题目' });

    const solutionGrid = JSON.parse(row.solution_grid);
    const isCorrect = JSON.stringify(solutionGrid) === JSON.stringify(playerGrid);
    const scoreEarned = recordGameResult(userId, gameId || 'life-game', difficulty, isCorrect, timeSpent);
    
    res.json({ isCorrect, scoreEarned, message: isCorrect ? '🎉 挑战成功！' : '❌ 挑战失败！', actualSolution: solutionGrid });
  });
});

module.exports = router;