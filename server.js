const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'supersecretkey1727',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// База данных
const db = new sqlite3.Database('database.db');

// Создание таблиц
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    rawStock INTEGER DEFAULT 0,
    paintedStock INTEGER DEFAULT 0,
    length REAL DEFAULT 1,
    width REAL DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    type TEXT,
    product TEXT,
    qty INTEGER,
    area REAL,
    note TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    product TEXT,
    qty INTEGER,
    customer TEXT,
    phone TEXT,
    dateNeeded TEXT,
    note TEXT,
    status TEXT DEFAULT 'Новая'
  )`);
});

// Инициализация начальных изделий
db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
  if (row.count === 0) {
    db.run("INSERT INTO products (name, length, width) VALUES (?, ?, ?)", ["Тумба 3 м", 3, 1]);
    db.run("INSERT INTO products (name, length, width) VALUES (?, ?, ?)", ["ТК 3.5 метр", 3.5, 1]);
  }
});

// Главная страница
app.get('/', (req, res) => {
  db.all("SELECT * FROM products", (err, products) => {
    res.render('index', { products });
  });
});

// Форма заявки
app.get('/request', (req, res) => {
  db.all("SELECT * FROM products", (err, products) => {
    res.render('request', { products });
  });
});

app.post('/submit-request', (req, res) => {
  const { productName, qty, customer, phone, dateNeeded, note } = req.body;
  db.run(`INSERT INTO requests (date, product, qty, customer, phone, dateNeeded, note) 
          VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)`,
    [productName, parseInt(qty), customer, phone, dateNeeded, note],
    () => {
      res.send('<h2 style="text-align:center;color:green;margin-top:50px">✅ Заявка отправлена!</h2><p style="text-align:center"><a href="/">Вернуться</a></p>');
    });
});

// Админ
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) res.redirect('/dashboard');
  else res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  if (req.body.password === '1727') {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else res.render('login', { error: 'Неверный пароль' });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  db.all("SELECT * FROM products", (err, products) => {
    db.all("SELECT * FROM operations ORDER BY id DESC LIMIT 100", (err, operations) => {
      res.render('dashboard', { products, operations });
    });
  });
});

// Покрасить
app.post('/paint', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  db.get("SELECT * FROM products WHERE name = ?", [productName], (err, product) => {
    if (product) {
      db.run("UPDATE products SET rawStock = rawStock - ?, paintedStock = paintedStock + ? WHERE name = ?", 
        [qtyNum, qtyNum, productName]);

      const area = (qtyNum * product.length * product.width).toFixed(1);
      db.run("INSERT INTO operations (date, type, product, qty, area, note) VALUES (datetime('now'), 'Покраска', ?, ?, ?, ?)",
        [productName, qtyNum, area, note]);
    }
    res.redirect('/dashboard');
  });
});

// Отгрузить
app.post('/send', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  db.run("UPDATE products SET paintedStock = paintedStock - ? WHERE name = ?", [qtyNum, productName]);
  db.run("INSERT INTO operations (date, type, product, qty, note) VALUES (datetime('now'), 'Отгрузка', ?, ?, ?)",
    [productName, qtyNum, note]);

  res.redirect('/dashboard');
});

// Новое изделие
app.post('/add-product', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { newProduct, length, width } = req.body;
  db.run("INSERT INTO products (name, length, width) VALUES (?, ?, ?)", 
    [newProduct, parseFloat(length), parseFloat(width)], 
    () => res.redirect('/dashboard'));
});

// Заявки
app.get('/requests', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  db.all("SELECT * FROM requests ORDER BY id DESC", (err, requests) => {
    res.render('requests', { requests });
  });
});

app.post('/update-request', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { id, status } = req.body;
  db.run("UPDATE requests SET status = ? WHERE id = ?", [status, id]);
  res.redirect('/requests');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Сервер с базой данных запущен на http://localhost:${PORT}`);
});
