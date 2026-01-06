from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import gspread
from google.oauth2.service_account import Credentials
import logging
import os

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False
    }
})

# Настройки
GOOGLE_SHEETS_CREDS = '/home/chronosphere/mysite/service_account.json'
MAIN_SPREADSHEET_ID = '13OZWPfVx5IWvKWOKzvZEwGbDeAuqmku_jGCvpSujpoQ'
DB_PATH = '/home/chronosphere/mysite/shops.db'

# Словарь перевода городов из 2ГИС в русские названия
CITY_TRANSLATION = {
    'tyumen': 'Тюмень',
    'moscow': 'Москва',
    'spb': 'Санкт-Петербург',
    'novosibirsk': 'Новосибирск',
    'ekaterinburg': 'Екатеринбург'
}

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_google_sheets_data(spreadsheet_id, range_name='A2:I1500', sheet_id=None):
    """Получение данных из Google Sheets
    
    Args:
        spreadsheet_id: ID таблицы
        range_name: Диапазон данных
        sheet_id: ID листа (gid). Если None, читается первый лист
    """
    try:
        scope = ['https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets']

        creds = Credentials.from_service_account_file(GOOGLE_SHEETS_CREDS, scopes=scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(spreadsheet_id)
        
        # Если указан sheet_id (gid), читаем конкретный лист
        if sheet_id is not None:
            sheet = spreadsheet.get_worksheet_by_id(int(sheet_id))
        else:
            # Иначе читаем первый лист
            sheet = spreadsheet.sheet1

        return sheet.get(range_name)
    except Exception as e:
        logger.error(f"Ошибка чтения Google Sheets: {e}")
        return []


def parse_shop_catalog_data(data):
    """
    Парсинг данных каталога магазина
    Использует ту же логику, что и в файле ишимбот.py
    """
    def convert_google_drive_link(url):
        """Конвертация ссылки Google Drive в прямую ссылку на изображение"""
        if not url or 'drive.google.com' not in url:
            return url
        
        # Извлекаем ID файла из различных форматов ссылок
        import re
        patterns = [
            r'/file/d/([a-zA-Z0-9_-]+)',
            r'id=([a-zA-Z0-9_-]+)',
            r'/d/([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                file_id = match.group(1)
                # Используем thumbnail API для получения изображения высокого качества
                return f'https://drive.google.com/thumbnail?id={file_id}&sz=w2000-h2000'
        
        return url
    
    catalog = {}
    current_section = None
    current_category = None
    current_model = None
    current_submodel = None

    for i, row in enumerate(data):
        if len(row) < 3 or (row[0] == "Раздел" and row[1] == "Категория"):
            continue

        # Обновляем текущие значения
        if row[0]:
            current_section = row[0].strip()
            current_category = None
            current_model = None
            current_submodel = None

        if len(row) > 1 and row[1]:
            current_category = row[1].strip()
            current_model = None
            current_submodel = None

        if len(row) > 2 and row[2]:
            current_model = row[2].strip()
            current_submodel = None

        if len(row) > 3 and row[3]:
            current_submodel = row[3].strip()

        if not current_section or not current_category:
            continue

        if not current_model:
            current_model = "Без модели"
        
        # Если подмодель не задана, используем пустую строку (товары будут сразу)
        if not current_submodel:
            current_submodel = ""

        color = row[4].strip() if len(row) > 4 and row[4] else None
        price = row[5].strip() if len(row) > 5 and row[5] else None
        photo_url = row[6].strip() if len(row) > 6 and row[6] else None
        description = row[7].strip() if len(row) > 7 and row[7] else None
        user_description = row[8].strip() if len(row) > 8 and row[8] else None

        # Конвертируем ссылку Google Drive в прямую ссылку
        if photo_url:
            photo_url = convert_google_drive_link(photo_url)

        # Пропускаем только если нет вообще никаких данных о товаре
        if not color and not price and not photo_url:
            continue

        # Создаем структуру данных
        if current_section not in catalog:
            catalog[current_section] = {}
        if current_category not in catalog[current_section]:
            catalog[current_section][current_category] = {}
        if current_model not in catalog[current_section][current_category]:
            catalog[current_section][current_category][current_model] = {}
        if current_submodel not in catalog[current_section][current_category][current_model]:
            catalog[current_section][current_category][current_model][current_submodel] = []

        # Добавляем товар
        product = {
            'color': color,
            'price': price,
            'photo_url': photo_url,
            'description': description,
            'user_description': user_description,
            'row_index': i + 2
        }
        
        catalog[current_section][current_category][current_model][current_submodel].append(product)

    return catalog


def sync_shops_from_table():
    """Вспомогательная функция синхронизации магазинов"""
    data = get_google_sheets_data(MAIN_SPREADSHEET_ID, 'A1:G1000')
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем все ID магазинов из таблицы
    table_shop_ids = set()
    shops_data = []
    current_category = 'Без категории'  # Категория по умолчанию
    
    for i, row in enumerate(data):
        # Пропускаем строку заголовков (первая строка)
        if i == 0 or (len(row) > 0 and row[0] and row[0].strip().lower() in ['id', '№', 'категория', 'kategoria']):
            logger.info(f"⏭️ Пропускаем строку заголовков: {row[:3] if len(row) > 3 else row}")
            continue
        
        # Проверяем, является ли строка заголовком категории
        # (если в столбце A есть значение, а в столбце B нет названия магазина или пустое)
        if len(row) >= 1 and row[0] and row[0].strip():
            # Проверяем что в столбце B нет данных или это не полноценная строка магазина
            if len(row) < 2 or not row[1] or not row[1].strip():
                # Это категория - обновляем текущую категорию
                current_category = row[0].strip()
                logger.info(f"📂 Найдена категория: {current_category}")
                continue
        
        if len(row) >= 4 and row[1] and row[3]:
            shop_id = row[3]
            shop_name = row[1]
            spreadsheet_url = row[2] if len(row) > 2 else ''
            photo_url = row[6].strip() if len(row) > 6 and row[6] else None
            
            # Парсим координаты из ссылки 2ГИС
            import re
            latitude, longitude, city = 0.0, 0.0, 'Не установлен'
            
            if len(row) > 4 and row[4]:  # Ссылка 2ГИС в столбце E
                # Ищем координаты в формате m=долгота,широта (может быть /m= или ?m= или &m=)
                coords_match = re.search(r'm=([0-9.]+)(?:%2C|,)([0-9.]+)', row[4])
                if coords_match:
                    longitude = float(coords_match.group(1))
                    latitude = float(coords_match.group(2))
                    logger.info(f"Parsed coords for {row[1]}: lat={latitude}, lon={longitude}")
                    city_match = re.search(r'2gis\.ru/([^/]+)/', row[4])
                    if city_match:
                        city_eng = city_match.group(1).lower()
                        city = CITY_TRANSLATION.get(city_eng, city_match.group(1).capitalize())
            
            table_shop_ids.add(shop_id)
            shops_data.append({
                'shop_id': shop_id,
                'shop_name': shop_name,
                'spreadsheet_url': spreadsheet_url,
                'city': city,
                'latitude': latitude,
                'longitude': longitude,
                'photo_url': photo_url,
                'category': current_category
            })
            logger.info(f"🏪 Магазин: {shop_name} → Категория: {current_category}")
    
    # Получаем все магазины из БД
    cursor.execute('SELECT shop_id FROM shops')
    db_shop_ids = set(row[0] for row in cursor.fetchall())
    
    # Удаляем магазины, которых нет в таблице
    shops_to_delete = db_shop_ids - table_shop_ids
    for shop_id in shops_to_delete:
        cursor.execute('DELETE FROM shops WHERE shop_id = ?', (shop_id,))
    
    # Добавляем/обновляем магазины из таблицы
    for shop in shops_data:
        cursor.execute('''
            INSERT OR REPLACE INTO shops (shop_id, shop_name, city, latitude, longitude, spreadsheet_url, photo_url, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (shop['shop_id'], shop['shop_name'], shop['city'], 
              shop['latitude'], shop['longitude'], shop['spreadsheet_url'], shop.get('photo_url'), shop['category']))
    
    conn.commit()
    conn.close()


@app.route('/api/cities', methods=['GET'])
def get_cities():
    """Получение списка городов с магазинами"""
    try:
        # Автоматическая синхронизация перед получением данных
        try:
            sync_shops_from_table()
        except Exception as sync_error:
            logger.warning(f"Ошибка автосинхронизации: {sync_error}")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT DISTINCT city 
            FROM shops 
            ORDER BY city
        ''')
        
        cities = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'cities': cities})
    except Exception as e:
        logger.error(f"Ошибка получения городов: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Получение списка всех категорий"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT DISTINCT category 
            FROM shops 
            WHERE category IS NOT NULL
            ORDER BY category
        ''')
        
        categories = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'categories': categories})
    except Exception as e:
        logger.error(f"Ошибка получения категорий: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/categories/<city>', methods=['GET'])
def get_categories_by_city(city):
    """Получение категорий для конкретного города"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT DISTINCT category 
            FROM shops 
            WHERE city = ? AND category IS NOT NULL
            ORDER BY category
        ''', (city,))
        
        categories = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'categories': categories})
    except Exception as e:
        logger.error(f"Ошибка получения категорий города: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/shops/<city>', methods=['GET'])
def get_shops_by_city(city):
    """Получение магазинов по городу"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT shop_id, shop_name, latitude, longitude, spreadsheet_url, photo_url, category
            FROM shops 
            WHERE city = ?
        ''', (city,))
        
        shops = []
        for row in cursor.fetchall():
            shops.append({
                'shop_id': row[0],
                'name': row[1],
                'latitude': row[2],
                'longitude': row[3],
                'spreadsheet_url': row[4],
                'photo_url': row[5],
                'category': row[6] if len(row) > 6 else 'Без категории'
            })
        
        conn.close()
        
        return jsonify({'shops': shops})
    except Exception as e:
        logger.error(f"Ошибка получения магазинов: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/shop/<shop_id>', methods=['GET'])
def get_shop_info(shop_id):
    """Получение информации о магазине"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT shop_name, city, spreadsheet_url
            FROM shops 
            WHERE shop_id = ?
        ''', (shop_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Магазин не найден'}), 404
        
        return jsonify({
            'name': row[0],
            'city': row[1],
            'spreadsheet_url': row[2]
        })
    except Exception as e:
        logger.error(f"Ошибка получения информации о магазине: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/shop/<shop_id>/catalog', methods=['GET'])
def get_shop_catalog(shop_id):
    """Получение каталога магазина из его Google Sheets таблицы"""
    try:
        # Получаем URL таблицы магазина
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT spreadsheet_url FROM shops WHERE shop_id = ?', (shop_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Магазин не найден'}), 404
        
        spreadsheet_url = row[0]
        
        # Извлекаем ID таблицы и ID листа (gid) из URL
        import re
        match = re.search(r'/d/([a-zA-Z0-9-_]+)', spreadsheet_url)
        if not match:
            return jsonify({'error': 'Неверный формат URL таблицы'}), 400
        
        spreadsheet_id = match.group(1)
        
        # Извлекаем gid (ID листа) если есть
        gid_match = re.search(r'[?#&]gid=([0-9]+)', spreadsheet_url)
        sheet_id = gid_match.group(1) if gid_match else None
        
        logger.info(f"Чтение каталога: spreadsheet_id={spreadsheet_id}, sheet_id={sheet_id}")
        
        # Получаем данные из таблицы магазина (читаем с A1, так как может не быть заголовка)
        data = get_google_sheets_data(spreadsheet_id, 'A1:I1500', sheet_id=sheet_id)
        
        # Парсим данные каталога
        catalog = parse_shop_catalog_data(data)
        
        return jsonify({'catalog': catalog})
    except Exception as e:
        logger.error(f"Ошибка получения каталога магазина: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/shops', methods=['POST'])
def admin_add_shop():
    """Добавление магазина администратором"""
    try:
        data = request.json
        
        # Валидация данных
        required_fields = ['shop_id', 'shop_name', 'city', 'latitude', 'longitude', 'spreadsheet_url']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Отсутствует поле {field}'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO shops (shop_id, shop_name, city, latitude, longitude, spreadsheet_url)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (data['shop_id'], data['shop_name'], data['city'], 
              data['latitude'], data['longitude'], data['spreadsheet_url']))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Магазин успешно добавлен'})
    except Exception as e:
        logger.error(f"Ошибка добавления магазина: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/shops/<shop_id>', methods=['DELETE'])
def admin_delete_shop(shop_id):
    """Удаление магазина администратором"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM shops WHERE shop_id = ?', (shop_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Магазин не найден'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Магазин успешно удален'})
    except Exception as e:
        logger.error(f"Ошибка удаления магазина: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/sync-shop/<shop_id>', methods=['POST'])
def admin_sync_single_shop(shop_id):
    """Синхронизация одного магазина по ID из главной таблицы"""
    try:
        # Получаем данные из главной таблицы
        data = get_google_sheets_data(MAIN_SPREADSHEET_ID, 'A2:F1000')
        
        shop_found = None
        for row in data:
            if len(row) >= 4 and row[3] == shop_id:  # Проверяем ID в столбце D
                # Парсим координаты из ссылки 2ГИС
                import re
                from urllib.parse import unquote
                latitude, longitude, city = 0.0, 0.0, 'Не установлен'
                
                if len(row) > 4 and row[4]:  # Ссылка 2ГИС в столбце E
                    # Формат 2ГИС: m=longitude,latitude/zoom
                    coords_match = re.search(r'm=([0-9.]+)(?:%2C|,)([0-9.]+)', row[4])
                    if coords_match:
                        longitude = float(coords_match.group(1))
                        latitude = float(coords_match.group(2))
                        # Определяем город из URL
                        city_match = re.search(r'2gis\.ru/([^/]+)/', row[4])
                        if city_match:
                            city_name = city_match.group(1)
                            city = city_name.capitalize()
                        else:
                            city = 'Не установлен'
                
                shop_found = {
                    'shop_id': row[3],
                    'shop_name': row[1],
                    'spreadsheet_url': row[2] if len(row) > 2 else '',
                    'city': city,
                    'latitude': latitude,
                    'longitude': longitude
                }
                break
        
        if not shop_found:
            return jsonify({'error': 'Магазин с таким ID не найден в таблице'}), 404
        
        # Добавляем/обновляем магазин в БД
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO shops (shop_id, shop_name, city, latitude, longitude, spreadsheet_url)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (shop_found['shop_id'], shop_found['shop_name'], shop_found['city'], 
              shop_found['latitude'], shop_found['longitude'], shop_found['spreadsheet_url']))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Магазин синхронизирован', 'shop_name': shop_found['shop_name']})
    except Exception as e:
        logger.error(f"Ошибка синхронизации магазина: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/sync', methods=['POST'])
def admin_sync_shops():
    """Синхронизация магазинов из главной таблицы"""
    try:
        # Получаем данные из главной таблицы
        data = get_google_sheets_data(MAIN_SPREADSHEET_ID, 'A1:G1000')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Получаем все ID магазинов из таблицы
        table_shop_ids = set()
        shops_data = []
        current_category = 'Без категории'  # Категория по умолчанию
        
        for i, row in enumerate(data):
            # Пропускаем строку заголовков (первая строка)
            if i == 0 or (len(row) > 0 and row[0] and row[0].strip().lower() in ['id', '№', 'категория', 'kategoria']):
                logger.info(f"⏭️ Пропускаем заголовок: {row[:3] if len(row) > 3 else row}")
                continue
            
            # Проверяем, является ли строка заголовком категории
            if len(row) >= 1 and row[0] and row[0].strip():
                # Проверяем что в столбце B нет данных
                if len(row) < 2 or not row[1] or not row[1].strip():
                    # Это категория
                    current_category = row[0].strip()
                    logger.info(f"📂 Категория найдена: {current_category}")
                    continue
            
            if len(row) >= 4 and row[1] and row[3]:
                shop_id = row[3]
                shop_name = row[1]
                spreadsheet_url = row[2] if len(row) > 2 else ''
                photo_url = row[6].strip() if len(row) > 6 and row[6] else None
                
                # Парсим координаты из ссылки 2ГИС
                import re
                latitude, longitude, city = 0.0, 0.0, 'Не установлен'
                
                if len(row) > 4 and row[4]:  # Ссылка 2ГИС в столбце E
                    coords_match = re.search(r'm=([0-9.]+)(?:%2C|,)([0-9.]+)', row[4])
                    if coords_match:
                        longitude = float(coords_match.group(1))
                        latitude = float(coords_match.group(2))
                        city_match = re.search(r'2gis\.ru/([^/]+)/', row[4])
                        if city_match:
                            city_eng = city_match.group(1).lower()
                            city = CITY_TRANSLATION.get(city_eng, city_match.group(1).capitalize())
                
                table_shop_ids.add(shop_id)
                shops_data.append({
                    'shop_id': shop_id,
                    'shop_name': shop_name,
                    'spreadsheet_url': spreadsheet_url,
                    'city': city,
                    'latitude': latitude,
                    'longitude': longitude,
                    'photo_url': photo_url,
                    'category': current_category
                })
        
        # Получаем все магазины из БД
        cursor.execute('SELECT shop_id FROM shops')
        db_shop_ids = set(row[0] for row in cursor.fetchall())
        
        # Удаляем магазины, которых нет в таблице
        shops_to_delete = db_shop_ids - table_shop_ids
        deleted_count = 0
        for shop_id in shops_to_delete:
            cursor.execute('DELETE FROM shops WHERE shop_id = ?', (shop_id,))
            deleted_count += 1
        
        # Добавляем/обновляем магазины из таблицы
        synced_count = 0
        for shop in shops_data:
            cursor.execute('''
                INSERT OR REPLACE INTO shops (shop_id, shop_name, city, latitude, longitude, spreadsheet_url, photo_url, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (shop['shop_id'], shop['shop_name'], shop['city'], 
                  shop['latitude'], shop['longitude'], shop['spreadsheet_url'], shop.get('photo_url'), shop['category']))
            synced_count += 1
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True, 
            'synced': synced_count, 
            'deleted': deleted_count,
            'message': f'Синхронизировано: {synced_count}, удалено: {deleted_count}'
        })
    except Exception as e:
        logger.error(f"Ошибка синхронизации: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/')
def index():
    """Главная страница API"""
    return jsonify({
        'name': 'Multi Shop API',
        'version': '1.0.0',
        'endpoints': [
            '/api/cities',
            '/api/shops/<city>',
            '/api/shop/<shop_id>',
            '/api/shop/<shop_id>/catalog',
            '/api/admin/shops',
            '/api/admin/sync'
        ]
    })


if __name__ == '__main__':
    app.run(debug=True)
