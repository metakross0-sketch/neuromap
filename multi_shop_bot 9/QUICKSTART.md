# Быстрый старт 🚀

Минимальная инструкция для запуска проекта за 15 минут.

## Шаг 1: Google Sheets (5 минут)

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект → Включите "Google Sheets API"
3. Создайте Service Account → Скачайте JSON ключ
4. Переименуйте в `service_account.json`
5. Откройте [главную таблицу](https://docs.google.com/spreadsheets/d/13OZWPfVx5IWvKWOKzvZEwGbDeAuqmku_jGCvpSujpoQ/edit)
6. Поделиться → Вставьте email из JSON → Редактор → Готово

## Шаг 2: Telegram бот (2 минуты)

1. Telegram → @BotFather
2. `/newbot` → Название → Username (заканчивается на `bot`)
3. Скопируйте токен

## Шаг 3: PythonAnywhere (5 минут)

1. Регистрация на [pythonanywhere.com](https://www.pythonanywhere.com/)
2. Files → Загрузите: `bot.py`, `flask_api.py`, `service_account.json`
3. Console → Bash:
```bash
pip3.10 install --user python-telegram-bot flask flask-cors gspread google-auth
```
4. Web → Add new web app → Flask
5. WSGI config → Замените на:
```python
import sys
path = '/home/yourusername/mysite'
if path not in sys.path:
    sys.path.append(path)
from flask_api import app as application
```
6. Reload web app

## Шаг 4: GitHub Pages (3 минуты)

1. GitHub → New repository → `multi-shop-bot` → Public
2. Загрузите файлы из `webapp/`
3. Settings → Pages → Source: main branch → Save
4. Скопируйте URL: `https://yourusername.github.io/multi-shop-bot`

## Шаг 5: Настройка (2 минуты)

### bot.py
```python
BOT_TOKEN = "ваш_токен"
WEB_APP_URL = "https://yourusername.github.io/multi-shop-bot"
GOOGLE_SHEETS_CREDS = '/home/yourusername/mysite/service_account.json'
DB_PATH = '/home/yourusername/mysite/shops.db'
```

### flask_api.py
```python
GOOGLE_SHEETS_CREDS = '/home/yourusername/mysite/service_account.json'
DB_PATH = '/home/yourusername/mysite/shops.db'
```

### webapp/config.js
```javascript
const CONFIG = {
    API_URL: 'https://yourusername.pythonanywhere.com',
    ADMIN_ID: 7250236442,
    // ...
};
```

## Шаг 6: Запуск

PythonAnywhere → Console → Bash:
```bash
cd mysite
python3.10 bot.py
```

## Тест

1. Telegram → Найдите своего бота
2. `/start` → Должны появиться 3 кнопки
3. "Открыть" → Должно открыться веб-приложение
4. Пока магазинов нет → Добавьте через админ панель

## Добавление первого магазина

1. Откройте `https://yourusername.github.io/multi-shop-bot/admin.html`
2. Заполните форму
3. Кликните на карту для установки местоположения
4. "Создать магазин"
5. Готово! Магазин появится в списке городов

---

**Важно:** Для полной инструкции см. [DEPLOY.md](DEPLOY.md)

**Проблемы?** Проверьте:
- [ ] Service Account имеет доступ к таблице
- [ ] Flask приложение запущено (Web → Reload)
- [ ] Бот запущен в консоли
- [ ] GitHub Pages включен
- [ ] URL в config.js правильный
