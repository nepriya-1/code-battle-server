// server.js
require('dotenv').config(); // Загружаем пароль из файла .env

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Драйвер для PostgreSQL

const app = express();
app.use(cors());
app.use(express.json());

// Подключаемся к базе данных Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Обязательно для облачных баз
});

// === API МАРШРУТЫ ===

// 1. Сохранить счёт (вызывается из игры)
app.post('/api/score', async (req, res) => {
    const { playerId, taskId, language } = req.body;
    try {
        await pool.query(
            'INSERT INTO scores (player_id, task_id, language) VALUES ($1, $2, $3)',
            [playerId, taskId, language]
        );
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// 2. Получить счёт игрока
app.get('/api/score/:playerId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM scores WHERE player_id = $1', [req.params.playerId]);
        res.json({ score: result.rows.length, tasks: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// 3. Таблица рекордов
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT player_id, COUNT(*) as score FROM scores GROUP BY player_id ORDER BY score DESC LIMIT 10'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));