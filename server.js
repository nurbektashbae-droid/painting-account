const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');

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

const PRODUCTS_FILE = 'products.json';
const OPERATIONS_FILE = 'operations.json';

let products = [];
let operations = [];

function loadData() {
  if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
  } else {
    products = [
      { name: "Тумба 3 м", rawStock: 0, paintedStock: 0, length: 3, width: 1 },
      { name: "ТК 3.5 метр", rawStock: 0, paintedStock: 0, length: 3.5, width: 1 }
    ];
    saveProducts();
  }
  if (fs.existsSync(OPERATIONS_FILE)) operations = JSON.parse(fs.readFileSync(OPERATIONS_FILE));
  else operations = [];
}

function saveProducts() { fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2)); }
function saveOperations() { fs.writeFileSync(OPERATIONS_FILE, JSON.stringify(operations, null, 2)); }

loadData();

// Главная (публичная)
app.get('/', (req, res) => res.render('index', { products }));

// Админ
app.get('/admin', (req, res) => req.session.loggedIn ? res.redirect('/dashboard') : res.render('login', { error: null }));

app.post('/login', (req, res) => {
  if (req.body.password === '1727') {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else res.render('login', { error: 'Неверный пароль' });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  res.render('dashboard', { products, operations: operations.slice(0, 100) });
});

// Добавить операцию покраски
app.post('/paint', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, length, width, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  let product = products.find(p => p.name === productName);
  if (!product) {
    product = { name: productName, rawStock: 0, paintedStock: 0, length: parseFloat(length)||1, width: parseFloat(width)||1 };
    products.push(product);
  }

  product.rawStock = (product.rawStock || 0) - qtyNum;
  product.paintedStock = (product.paintedStock || 0) + qtyNum;
  saveProducts();

  operations.unshift({
    date: new Date().toLocaleDateString('ru-RU'),
    type: 'Покраска',
    product: productName,
    qty: qtyNum,
    area: (qtyNum * (product.length||1) * (product.width||1)).toFixed(2),
    note: note || ''
  });
  saveOperations();
  res.redirect('/dashboard');
});

// Отправка (отгрузка крашенных)
app.post('/send', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  const product = products.find(p => p.name === productName);
  if (product) {
    product.paintedStock = (product.paintedStock || 0) - qtyNum;
    saveProducts();
  }

  operations.unshift({
    date: new Date().toLocaleDateString('ru-RU'),
    type: 'Отгрузка',
    product: productName,
    qty: qtyNum,
    note: note || ''
  });
  saveOperations();
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => console.log(`Сервер работает`));
