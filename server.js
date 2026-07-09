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

// Файлы данных
const PRODUCTS_FILE = 'products.json';
const OPERATIONS_FILE = 'operations.json';
const REQUESTS_FILE = 'requests.json';

let products = [];
let operations = [];
let requests = [];

// Загрузка данных
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
  if (fs.existsSync(REQUESTS_FILE)) requests = JSON.parse(fs.readFileSync(REQUESTS_FILE));
}

function saveProducts() { fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2)); }
function saveOperations() { fs.writeFileSync(OPERATIONS_FILE, JSON.stringify(operations, null, 2)); }
function saveRequests() { fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2)); }

loadData();

// ====================== РОУТЫ ======================

// Главная (публичная)
app.get('/', (req, res) => res.render('index', { products }));

// Форма заявки
app.get('/request', (req, res) => res.render('request', { products }));

// Отправка заявки
app.post('/submit-request', (req, res) => {
  const { productName, qty, customer, phone, dateNeeded, note } = req.body;
  requests.unshift({
    id: Date.now(),
    date: new Date().toLocaleDateString('ru-RU'),
    product: productName,
    qty: parseInt(qty) || 0,
    customer: customer || 'Клиент',
    phone: phone || '',
    dateNeeded: dateNeeded || '',
    note: note || '',
    status: 'Новая'
  });
  saveRequests();
  res.send('<h2 style="text-align:center;color:green;margin-top:50px">✅ Заявка отправлена успешно!</h2><p style="text-align:center"><a href="/">Вернуться к остаткам</a></p>');
});

// Админ вход
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) res.redirect('/dashboard');
  else res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  if (req.body.password === '1727') {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Неверный пароль' });
  }
});

// Админ панель
app.get('/dashboard', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  res.render('dashboard', { products, operations: operations.slice(0, 100) });
});

// Покрасить
app.post('/paint', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  let product = products.find(p => p.name === productName);
  if (!product) {
    product = { name: productName, rawStock: 0, paintedStock: 0, length: 1, width: 1 };
    products.push(product);
  }

  product.rawStock = (product.rawStock || 0) - qtyNum;
  product.paintedStock = (product.paintedStock || 0) + qtyNum;

  operations.unshift({
    date: new Date().toLocaleDateString('ru-RU'),
    type: 'Покраска',
    product: productName,
    qty: qtyNum,
    area: (qtyNum * (product.length||1) * (product.width||1)).toFixed(1),
    note: note || ''
  });

  saveProducts();
  saveOperations();
  res.redirect('/dashboard');
});

// Отгрузка
app.post('/send', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { productName, qty, note } = req.body;
  const qtyNum = parseInt(qty) || 0;

  const product = products.find(p => p.name === productName);
  if (product) product.paintedStock = (product.paintedStock || 0) - qtyNum;

  operations.unshift({
    date: new Date().toLocaleDateString('ru-RU'),
    type: 'Отгрузка',
    product: productName,
    qty: qtyNum,
    note: note || ''
  });

  saveProducts();
  saveOperations();
  res.redirect('/dashboard');
});

// Новое изделие
app.post('/add-product', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { newProduct, length, width } = req.body;
  if (newProduct) {
    products.push({
      name: newProduct,
      rawStock: 0,
      paintedStock: 0,
      length: parseFloat(length) || 1,
      width: parseFloat(width) || 1
    });
    saveProducts();
  }
  res.redirect('/dashboard');
});

// Заявки
app.get('/requests', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  res.render('requests', { requests });
});

app.post('/update-request', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  const { id, status } = req.body;
  const reqItem = requests.find(r => r.id == id);
  if (reqItem) reqItem.status = status;
  saveRequests();
  res.redirect('/requests');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
