// server.js
require('dotenv').config(); // Загружаем пароль из файла .env

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Драйвер для PostgreSQL
const http = require('http'); // Нужно для Socket.IO
const { Server } = require('socket.io'); // Импортируем Socket.IO


const app = express();
app.use(cors());
app.use(express.json());

// Создаем HTTP-сервер на основе Express
const server = http.createServer(app);

// Инициализируем Socket.IO с настройками CORS (чтобы игра с GitHub могла подключаться)
const io = new Server(server, {
  cors: {
    origin: "*", // В учебных целях разрешаем всем
    methods: ["GET", "POST"]
  }
});
    
// Подключаемся к базе данных Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Обязательно для облачных баз
});



// === ЛОГИКА МУЛЬТИПЛЕЕРА ===
// Храним позиции игроков в памяти сервера (сбрасывается при перезагрузке)
const players = {};

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // 1. ДОБАВЛЯЕМ НОВОГО ИГРОКА В ПАМЯТЬ СЕРВЕРА
  players[socket.id] = {
    id: socket.id,
    x: 1320, // Начальные координаты
    y: 1128,
    characterKey: 'js' // По умолчанию
  };

  // 1. Отправляем новому игроку список всех, кто уже в игре
  socket.emit('currentPlayers', players);

  // 2. Сообщаем всем остальным, что появился новый игрок
  socket.broadcast.emit('newPlayer', { id: socket.id, x: 1320, y: 1128 });

  // 3. Обрабатываем движение игрока
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].characterKey = movementData.characterKey;
      
      // Пересылаем новые координаты ВСЕМ, КРОМЕ отправителя
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: movementData.x,
        y: movementData.y,
        characterKey: movementData.characterKey
      });
    }
  });

  // 4. Когда игрок отключается — удаляем его
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
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
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));