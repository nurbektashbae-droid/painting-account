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
      { name: "Тумба 3 м", stock: 0 },
      { name: "ТК 3.5 метр", stock: 0 }
    ];
    saveProducts();
  }
  
  if (fs.existsSync(OPERATIONS_FILE)) {
    operations = JSON.parse(fs.readFileSync(OPERATIONS_FILE));
  } else {
    operations = [];
    saveOperations();
  }
}

function saveProducts() {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

function saveOperations() {
  fs.writeFileSync(OPERATIONS_FILE, JSON.stringify(operations, null, 2));
}

loadData();

// Главная страница (публичная)
app.get('/', (req, res) => {
  res.render('index', { products });
});

// Админ вход
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: null });
  }
});

app.post('/login', (req, res) => {
  if (req.body.password === '1727') {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Неверный пароль' });
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  res.render('dashboard', { products, operations: operations.slice(0, 100) });
});

app.post('/add-operation', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin');
  
  const { productName, painted, sent, note } = req.body;
  const paintedNum = parseInt(painted) || 0;
  const sentNum = parseInt(sent) || 0;
  
  const product = products.find(p => p.name === productName);
  if (product) {
    product.stock += paintedNum - sentNum;
    saveProducts();
  }
  
  operations.unshift({
    date: new Date().toLocaleDateString('ru-RU'),
    product: productName,
    painted: paintedNum,
    sent: sentNum,
    note: note || ''
  });
  
  saveOperations();
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Сервер работает на порту ${PORT}`);
});
