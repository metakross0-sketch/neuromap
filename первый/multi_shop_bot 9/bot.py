import logging
import sqlite3
import gspread
from google.oauth2.service_account import Credentials
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, MenuButtonWebApp, WebAppInfo
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters
)

print("✅ Скрипт начал выполнение")
print("✅ Импорты успешны")

# Настройки
ADMIN_ID = 7250236442
BOT_TOKEN = "8574504870:AAGYhI42Zp7NV6R_sFtvVVlQFtYahyLi-3U"
WEB_APP_URL = "https://metakross0-sketch.github.io/chronosphere_app/index2.html"

# Google Sheets настройки
GOOGLE_SHEETS_CREDS = 'service_account.json'  # Путь к файлу с учетными данными
MAIN_SPREADSHEET_ID = '13OZWPfVx5IWvKWOKzvZEwGbDeAuqmku_jGCvpSujpoQ'  # ID главной таблицы

# База данных
DB_PATH = '/home/chronosphere/mysite/shops.db'  # Путь для PythonAnywhere

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

print("✅ Настройки загружены")


def init_database():
    """Инициализация базы данных SQLite"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Таблица магазинов
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id TEXT UNIQUE NOT NULL,
        shop_name TEXT NOT NULL,
        city TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        spreadsheet_url TEXT NOT NULL,
        photo_url TEXT,
        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Таблица пользователей
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Миграция: добавляем photo_url в shops, если колонки нет
    try:
        cursor.execute("PRAGMA table_info(shops)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'photo_url' not in columns:
            cursor.execute("ALTER TABLE shops ADD COLUMN photo_url TEXT")
            logger.info("✅ Колонка photo_url добавлена в таблицу shops")
        if 'category' not in columns:
            cursor.execute("ALTER TABLE shops ADD COLUMN category TEXT DEFAULT 'Без категории'")
            logger.info("✅ Колонка category добавлена в таблицу shops")
    except Exception as e:
        logger.error(f"Ошибка при миграции: {e}")

    conn.commit()
    conn.close()
    logger.info("✅ База данных инициализирована")


def get_shops_from_google_sheets():
    """Получение списка магазинов из Google Sheets"""
    try:
        scope = ['https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets']

        creds = Credentials.from_service_account_file(GOOGLE_SHEETS_CREDS, scopes=scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key(MAIN_SPREADSHEET_ID).sheet1

        # Получаем все данные из таблицы (столбцы A-F)
        data = sheet.get('A2:F1000')
        
        shops = []
        current_category = 'Без категории'  # Категория по умолчанию
        
        for row in data:
            # Проверяем, является ли строка заголовком категории
            # (если в столбце A есть значение, а в столбце B нет названия магазина)
            if len(row) >= 1 and row[0] and (len(row) < 2 or not row[1]):
                # Это категория - обновляем текущую категорию
                current_category = row[0].strip()
                continue
            
            if len(row) >= 4 and row[1] and row[3]:  # Проверяем наличие названия и ID
                # Парсим координаты из ссылки 2ГИС (столбец E)
                latitude, longitude, city = parse_2gis_link(row[4] if len(row) > 4 else '')
                
                shops.append({
                    'date': row[0] if len(row) > 0 else '',
                    'name': row[1],
                    'spreadsheet_url': row[2] if len(row) > 2 else '',
                    'shop_id': row[3],
                    'gis_link': row[4] if len(row) > 4 else '',
                    'description': row[5] if len(row) > 5 else '',
                    'latitude': latitude,
                    'longitude': longitude,
                    'city': city,
                    'category': current_category
                })
        
        return shops
    except Exception as e:
        logger.error(f"Ошибка чтения Google Sheets: {e}")
        return []


def parse_2gis_link(link):
    """Парсинг координат и города из ссылки 2ГИС"""
    import re
    
    if not link:
        return 0.0, 0.0, 'Не установлен'
    
    try:
        # Ищем координаты в параметре m= (формат: m=долгота,широта)
        coords_match = re.search(r'm=([0-9.]+)(?:%2C|,)([0-9.]+)', link)
        if coords_match:
            lon = float(coords_match.group(1))
            lat = float(coords_match.group(2))
            logger.info(f"Parsed 2GIS link: lat={lat}, lon={lon}, link={link}")
            
            # Определяем город по координатам
            city = determine_city_by_coords(lat, lon)
            
            return lat, lon, city
        
        return 0.0, 0.0, 'Не установлен'
    except Exception as e:
        logger.error(f"Ошибка парсинга 2ГИС ссылки: {e}")
        return 0.0, 0.0, 'Не установлен'


def determine_city_by_coords(lat, lon):
    """Определение города по координатам"""
    # Простая логика - можно расширить
    cities = {
        'Тюмень': (57.1522, 65.5272, 0.5),  # lat, lon, radius
        'Москва': (55.7558, 37.6173, 0.5),
        'Санкт-Петербург': (59.9311, 30.3609, 0.5),
    }
    
    for city_name, (city_lat, city_lon, radius) in cities.items():
        if abs(lat - city_lat) < radius and abs(lon - city_lon) < radius:
            return city_name
    
    return 'Другой город'


def sync_shops_to_db():
    """Синхронизация магазинов из Google Sheets в базу данных"""
    shops = get_shops_from_google_sheets()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем список ID из таблицы
    table_ids = [shop['shop_id'] for shop in shops]
    
    # Удаляем магазины которых нет в таблице
    if table_ids:
        placeholders = ','.join(['?' for _ in table_ids])
        cursor.execute(f'DELETE FROM shops WHERE shop_id NOT IN ({placeholders})', table_ids)
    else:
        cursor.execute('DELETE FROM shops')
    
    # Добавляем/обновляем магазины из таблицы
    for shop in shops:
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO shops (shop_id, shop_name, city, latitude, longitude, spreadsheet_url, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (shop['shop_id'], shop['name'], shop['city'], 
                  shop['latitude'], shop['longitude'], shop['spreadsheet_url'], shop.get('category', 'Без категории')))
        except Exception as e:
            logger.error(f"Ошибка добавления магазина {shop['name']}: {e}")
    
    conn.commit()
    conn.close()
    logger.info(f"✅ Синхронизировано магазинов: {len(shops)}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    user = update.effective_user
    
    # Сохраняем пользователя в БД
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO users (user_id, username, first_name, last_name)
        VALUES (?, ?, ?, ?)
    ''', (user.id, user.username, user.first_name, user.last_name))
    conn.commit()
    conn.close()

    # Создаем клавиатуру с кнопками
    keyboard = [
        [InlineKeyboardButton("🏪 Открыть", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("ℹ️ Информация", callback_data="info")],
        [InlineKeyboardButton("👤 Администратор", url=f"tg://user?id={ADMIN_ID}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"👋 Добро пожаловать, {user.first_name}!\n\n"
        "🏪 Выберите действие:",
        reply_markup=reply_markup
    )
    
    logger.info(f"Пользователь {user.id} ({user.username}) запустил бота")


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик нажатий на inline кнопки"""
    query = update.callback_query
    await query.answer()

    if query.data == "info":
        await query.message.reply_text(
            "ℹ️ Информация о боте\n\n"
            "Здесь будет размещена информация о магазинах и услугах."
        )


async def admin_add_shop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда для администратора - добавление магазина"""
    user_id = update.effective_user.id
    
    if user_id != ADMIN_ID:
        await update.message.reply_text("❌ У вас нет прав администратора")
        return
    
    # Здесь будет логика добавления магазина через состояния (ConversationHandler)
    await update.message.reply_text(
        "🏪 Добавление нового магазина\n\n"
        "Эта функция будет реализована через веб-интерфейс администратора."
    )


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик ошибок"""
    logger.error(f"Ошибка: {context.error}")
    
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "❌ Произошла ошибка. Попробуйте позже."
        )


def main():
    """Основная функция запуска бота"""
    print("🚀 Запуск бота...")
    
    # Инициализация базы данных
    init_database()
    
    # Синхронизация магазинов из Google Sheets
    sync_shops_to_db()
    
    # Создание приложения
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # Регистрация обработчиков
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("add_shop", admin_add_shop))
    application.add_handler(CallbackQueryHandler(button_handler))
    application.add_error_handler(error_handler)

    # Запуск бота
    print("✅ Бот запущен и готов к работе!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
