#!/usr/bin/env python3
"""
Скрипт для проверки и обновления базы данных на PythonAnywhere
Запустить на PythonAnywhere: python3 check_and_fix_db.py
"""

import sqlite3
import sys

DB_PATH = '/home/chronosphere/mysite/shops.db'

def check_db_structure():
    """Проверяет структуру базы данных"""
    print("=" * 60)
    print("ПРОВЕРКА СТРУКТУРЫ БАЗЫ ДАННЫХ")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем структуру таблицы shops
        cursor.execute("PRAGMA table_info(shops)")
        columns = cursor.fetchall()
        
        print("\nТекущие столбцы в таблице 'shops':")
        print("-" * 60)
        for col in columns:
            print(f"  {col[1]:20s} {col[2]:10s} {'NOT NULL' if col[3] else ''} {'PRIMARY KEY' if col[5] else ''}")
        
        # Проверяем наличие столбца category
        column_names = [col[1] for col in columns]
        has_category = 'category' in column_names
        
        print("\n" + "=" * 60)
        if has_category:
            print("✅ Столбец 'category' существует")
        else:
            print("❌ Столбец 'category' ОТСУТСТВУЕТ - требуется миграция!")
        print("=" * 60)
        
        conn.close()
        return has_category
        
    except Exception as e:
        print(f"❌ Ошибка проверки структуры БД: {e}")
        return False


def check_data():
    """Проверяет данные в базе"""
    print("\n" + "=" * 60)
    print("ПРОВЕРКА ДАННЫХ")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем наличие столбца category
        cursor.execute("PRAGMA table_info(shops)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'category' in columns:
            # Проверяем данные с категориями
            cursor.execute('SELECT COUNT(*) FROM shops')
            total_count = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM shops WHERE category IS NOT NULL AND category != ""')
            with_category = cursor.fetchone()[0]
            
            print(f"\nВсего магазинов: {total_count}")
            print(f"С категориями: {with_category}")
            print(f"Без категорий: {total_count - with_category}")
            
            # Показываем примеры
            cursor.execute('SELECT shop_id, shop_name, city, category FROM shops LIMIT 5')
            shops = cursor.fetchall()
            
            print("\nПримеры магазинов:")
            print("-" * 60)
            for shop in shops:
                category = shop[3] if shop[3] else "Без категории"
                print(f"  {shop[0]:15s} | {shop[1]:20s} | {shop[2]:15s} | {category}")
            
            # Показываем все категории
            cursor.execute('SELECT DISTINCT category FROM shops WHERE category IS NOT NULL ORDER BY category')
            categories = cursor.fetchall()
            
            print("\nВсе категории в БД:")
            print("-" * 60)
            if categories:
                for cat in categories:
                    print(f"  🏷️ {cat[0]}")
            else:
                print("  (нет категорий)")
        else:
            print("⚠️  Столбец category отсутствует, пропускаем проверку данных")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка проверки данных: {e}")


def add_category_column():
    """Добавляет столбец category если его нет"""
    print("\n" + "=" * 60)
    print("МИГРАЦИЯ БАЗЫ ДАННЫХ")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем наличие столбца
        cursor.execute("PRAGMA table_info(shops)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'category' not in columns:
            print("\n⚙️  Добавляем столбец 'category'...")
            cursor.execute("ALTER TABLE shops ADD COLUMN category TEXT DEFAULT 'Без категории'")
            conn.commit()
            print("✅ Столбец 'category' успешно добавлен!")
        else:
            print("\n✅ Столбец 'category' уже существует, миграция не требуется")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")
        return False


def trigger_sync():
    """Информация о синхронизации данных"""
    print("\n" + "=" * 60)
    print("СИНХРОНИЗАЦИЯ ДАННЫХ")
    print("=" * 60)
    print("""
Для синхронизации данных из Google Sheets выполните:

ВАРИАНТ 1 - Через API (рекомендуется):
    curl -X POST https://chronosphere.pythonanywhere.com/api/admin/sync

ВАРИАНТ 2 - Через Python:
    python3 -c "import requests; r = requests.post('https://chronosphere.pythonanywhere.com/api/admin/sync'); print(r.json())"

ВАРИАНТ 3 - Автоматически при загрузке городов:
    Просто откройте приложение - синхронизация выполнится автоматически
    """)


def main():
    print("\n" + "🔧 " * 20)
    print("СКРИПТ ПРОВЕРКИ И ОБНОВЛЕНИЯ БД")
    print("🔧 " * 20)
    print(f"\nПуть к БД: {DB_PATH}\n")
    
    # Шаг 1: Проверка структуры
    has_category = check_db_structure()
    
    # Шаг 2: Если нет столбца - выполняем миграцию
    if not has_category:
        print("\n⚠️  Обнаружена проблема! Выполняем миграцию...")
        success = add_category_column()
        if not success:
            print("\n❌ Миграция не удалась! Проверьте права доступа к БД.")
            sys.exit(1)
    
    # Шаг 3: Проверка данных
    check_data()
    
    # Шаг 4: Инструкции по синхронизации
    trigger_sync()
    
    print("\n" + "=" * 60)
    print("✅ ПРОВЕРКА ЗАВЕРШЕНА")
    print("=" * 60)
    print("\nСледующие шаги:")
    print("1. Если столбец был добавлен - выполните синхронизацию (см. выше)")
    print("2. Перезагрузите веб-приложение: Web -> Reload")
    print("3. Откройте приложение и проверьте фильтр категорий\n")


if __name__ == '__main__':
    main()
