# Структура проекта Multi Shop Bot

```
multi_shop_bot/
│
├── README.md                      # Основная документация
├── DEPLOY.md                      # Пошаговая инструкция по развертыванию
├── requirements.txt               # Зависимости Python
├── .gitignore                     # Игнорируемые файлы для Git
├── service_account.json.example   # Пример credentials для Google Sheets
│
├── bot.py                         # Telegram бот (PythonAnywhere)
│   ├── Команды:
│   │   ├── /start - Главное меню
│   │   └── /add_shop - Добавление магазина (админ)
│   ├── Функции:
│   │   ├── Синхронизация с Google Sheets
│   │   ├── База данных SQLite
│   │   └── Веб-приложение (WebApp)
│
├── flask_api.py                   # Flask API сервер (PythonAnywhere)
│   ├── Endpoints:
│   │   ├── GET  /api/cities
│   │   ├── GET  /api/shops/<city>
│   │   ├── GET  /api/shop/<shop_id>
│   │   ├── GET  /api/shop/<shop_id>/catalog
│   │   ├── POST /api/admin/shops
│   │   └── POST /api/admin/sync
│   ├── Функции:
│   │   ├── Интеграция с Google Sheets
│   │   ├── Парсинг каталогов магазинов
│   │   └── CORS для веб-приложения
│
└── webapp/                        # Веб-приложение (GitHub Pages)
    │
    ├── config.js                  # Конфигурация (API URL, Admin ID)
    │
    ├── index.html                 # Главная страница
    │   ├── Выбор города
    │   ├── Карта с магазинами (Leaflet.js)
    │   ├── Модальное окно магазина
    │   └── Переход к каталогу
    │
    ├── shop.html                  # Страница каталога магазина
    │   ├── Загрузка данных из localStorage
    │   ├── Навигация по каталогу:
    │   │   ├── Разделы
    │   │   ├── Категории
    │   │   ├── Модели
    │   │   ├── Подмодели
    │   │   └── Товары
    │   ├── Хлебные крошки
    │   └── Модальное окно товара
    │
    └── admin.html                 # Админ панель
        ├── Добавление магазина:
        │   ├── Форма ввода данных
        │   ├── Выбор на карте
        │   └── Отправка на API
        ├── Список магазинов
        └── Синхронизация с Google Sheets
```

## Базы данных

### shops.db (SQLite)
```sql
-- Таблица магазинов
CREATE TABLE shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    spreadsheet_url TEXT NOT NULL,
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользователей
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Google Sheets структура

### Главная таблица (ID: 13OZWPfVx5IWvKWOKzvZEwGbDeAuqmku_jGCvpSujpoQ)
```
A          | B               | C                                    | D
-----------|-----------------|--------------------------------------|----------
Дата       | Название        | Ссылка на таблицу                   | ID
23.12.2025 | Магазин Тюмень  | https://docs.google.com/...         | shop001
24.12.2025 | Магазин Москва  | https://docs.google.com/...         | shop002
```

### Таблица магазина (структура как в ишимбот.py)
```
A       | B         | C      | D         | E     | F     | G         | H               | I
--------|-----------|--------|-----------|-------|-------|-----------|-----------------|------------------
Раздел  | Категория | Модель | Подмодель | Цвет  | Цена  | URL фото  | Описание (AI)   | Описание (user)
Одежда  | Куртки    | Зимняя | Мужская   | Черный| 5000₽ | https://..| Теплая куртка   | Для зимы
Одежда  | Куртки    | Зимняя | Мужская   | Синий | 5000₽ | https://..| Теплая куртка   | Для зимы
```

## Потоки данных

### 1. Добавление магазина администратором

```
Админ панель (admin.html)
    ↓ (POST)
Flask API (/api/admin/shops)
    ↓
SQLite DB (shops table)
    ↓
Доступен в списке городов
```

### 2. Синхронизация из Google Sheets

```
Google Sheets (главная таблица)
    ↓ (gspread)
Flask API (/api/admin/sync) или bot.py (sync_shops_to_db)
    ↓
SQLite DB (shops table)
    ↓
Доступен в списке городов (координаты нужно установить через админ панель)
```

### 3. Открытие магазина пользователем

```
Пользователь → Telegram Bot (/start)
    ↓
Бот → Кнопка "Открыть" (WebApp)
    ↓
index.html → GET /api/cities
    ↓
Выбор города → GET /api/shops/<city>
    ↓
Карта с магазинами (Leaflet.js)
    ↓
Клик на магазин → Модальное окно
    ↓
"Открыть магазин" → GET /api/shop/<shop_id>/catalog
    ↓
localStorage.setItem('shopCatalog', catalog)
    ↓
shop.html → Показ каталога
```

### 4. Навигация по каталогу магазина

```
shop.html
    ↓
catalogData из localStorage
    ↓
Навигация:
    Разделы → Категории → Модели → Подмодели → Товары
    ↑_______________________________________________|
                (Хлебные крошки)
```

## Технологии

### Backend (PythonAnywhere)
- Python 3.10+
- python-telegram-bot 20.7
- Flask 3.0.0
- gspread 5.12.0
- SQLite3

### Frontend (GitHub Pages)
- HTML5
- CSS3 (Custom design)
- JavaScript (ES6+)
- Leaflet.js (карты)
- Telegram WebApp SDK

### Интеграции
- Google Sheets API (gspread)
- Telegram Bot API
- OpenStreetMap (Leaflet tiles)

## Особенности реализации

1. **Логика каталога идентична ишимбот.py**
   - Парсинг данных из Google Sheets
   - Структура: Раздел → Категория → Модель → Подмодель → Товары
   - Поддержка фото, цен, описаний

2. **Безопасность**
   - Только администратор (ID: 7250236442) может управлять магазинами
   - Service Account для доступа к Google Sheets
   - CORS настроен для безопасного API

3. **Масштабируемость**
   - Поддержка неограниченного количества городов
   - Поддержка неограниченного количества магазинов
   - Каждый магазин имеет свою таблицу

4. **User Experience**
   - Telegram WebApp для нативного опыта
   - Интерактивные карты
   - Breadcrumbs навигация
   - Модальные окна
   - Responsive design

## Следующие шаги для расширения

1. Поиск по каталогу
2. Избранное (favorites)
3. Уведомления о новых товарах
4. Отслеживание цен
5. Чат с магазином
6. Отзывы и рейтинги
7. Аналитика для администратора
