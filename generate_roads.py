#!/usr/bin/env python3
"""
Скрипт для генерации статических GeoJSON файлов с дорогами городов.
Запускать на своем ПК для обновления данных.

Использование:
    python generate_roads.py
"""

import requests
import json
import os
import time
from pathlib import Path

# URL к Flask API для получения списка городов
FLASK_API_URL = "https://chronosphere.pythonanywhere.com"

# Overpass серверы
OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
]

# Папка для сохранения GeoJSON файлов
OUTPUT_DIR = Path(__file__).parent / "public" / "roads"

def slugify(text):
    """Преобразует название города в slug для имени файла"""
    # Транслитерация кириллицы
    translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    }
    
    text = text.lower()
    result = []
    for char in text:
        if char in translit:
            result.append(translit[char])
        elif char == ' ':
            result.append('_')
        elif char.isalnum() or char == '_':
            result.append(char)
    
    return ''.join(result)

def get_cities_with_shops():
    """Получает список городов с магазинами из Flask API"""
    print("📡 Получаем список городов...")
    try:
        response = requests.get(f"{FLASK_API_URL}/api/cities")
        data = response.json()
        cities = data.get('cities', [])
        print(f"✅ Найдено городов: {len(cities)}")
        return cities
    except Exception as e:
        print(f"❌ Ошибка получения городов: {e}")
        return []

def get_shops_for_city(city_name):
    """Получает магазины города"""
    try:
        response = requests.get(f"{FLASK_API_URL}/api/shops/{city_name}")
        data = response.json()
        return data.get('shops', [])
    except Exception as e:
        print(f"❌ Ошибка получения магазинов {city_name}: {e}")
        return []

def calculate_bbox(shops, buffer_km=30):
    """Вычисляет bbox вокруг магазинов с буфером в км"""
    if not shops:
        return None
    
    lats = [shop['latitude'] for shop in shops]
    lngs = [shop['longitude'] for shop in shops]
    
    min_lat = min(lats)
    max_lat = max(lats)
    min_lng = min(lngs)
    max_lng = max(lngs)
    
    # 1 градус ≈ 111 км
    buffer_deg = buffer_km / 111.0
    
    south = min_lat - buffer_deg
    north = max_lat + buffer_deg
    west = min_lng - buffer_deg
    east = max_lng + buffer_deg
    
    return f"{south},{west},{north},{east}"

def fetch_roads(bbox, server_index=0):
    """Загружает дороги из Overpass API"""
    query = f"""
    [out:json][timeout:90];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|road|service|living_street|footway|path|track|cycleway|pedestrian"]["highway"!~".*_link"]({bbox});
    );
    out geom;
    """
    
    server = OVERPASS_SERVERS[server_index % len(OVERPASS_SERVERS)]
    
    try:
        print(f"   🌐 Запрос к {server}...")
        response = requests.post(server, data=query, timeout=120)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            print(f"   ⚠️ Rate limit на {server}, ждем 5 сек...")
            time.sleep(5)
            return None
        else:
            print(f"   ❌ Ошибка {response.status_code}")
            return None
    except requests.exceptions.Timeout:
        print(f"   ⏱️ Timeout на {server}")
        return None
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        return None

def generate_road_files():
    """Генерирует GeoJSON файлы для всех городов"""
    # Создаем папку для файлов
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Папка для файлов: {OUTPUT_DIR}\n")
    
    # Получаем города
    cities = get_cities_with_shops()
    if not cities:
        print("❌ Нет городов для обработки")
        return
    
    success_count = 0
    fail_count = 0
    
    for i, city_name in enumerate(cities, 1):
        print(f"\n[{i}/{len(cities)}] 🏙️ {city_name}")
        
        # Получаем магазины
        shops = get_shops_for_city(city_name)
        if not shops:
            print(f"   ⚠️ Нет магазинов, пропускаем")
            fail_count += 1
            continue
        
        print(f"   📍 Магазинов: {len(shops)}")
        
        # Вычисляем bbox
        bbox = calculate_bbox(shops, buffer_km=30)
        if not bbox:
            print(f"   ❌ Не удалось вычислить bbox")
            fail_count += 1
            continue
        
        coords = bbox.split(',')
        area_km = f"{(float(coords[2]) - float(coords[0])) * 111:.1f}×{(float(coords[3]) - float(coords[1])) * 111:.1f}км"
        print(f"   📏 Область: {area_km}")
        
        # Пробуем загрузить с разных серверов
        data = None
        for attempt in range(len(OVERPASS_SERVERS)):
            data = fetch_roads(bbox, server_index=attempt)
            if data:
                break
            time.sleep(2)
        
        if not data or not data.get('elements'):
            print(f"   ❌ Не удалось загрузить дороги")
            fail_count += 1
            continue
        
        roads_count = len(data['elements'])
        print(f"   ✅ Загружено дорог: {roads_count}")
        
        # Сохраняем файл
        city_slug = slugify(city_name)
        output_file = OUTPUT_DIR / f"{city_slug}.geojson"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        
        file_size_mb = output_file.stat().st_size / 1024 / 1024
        print(f"   💾 Сохранено: {output_file.name} ({file_size_mb:.1f} МБ)")
        
        success_count += 1
        
        # Пауза между городами чтобы не перегружать API
        if i < len(cities):
            print(f"   ⏸️ Пауза 3 сек...")
            time.sleep(3)
    
    print(f"\n" + "="*60)
    print(f"✅ Успешно: {success_count}")
    print(f"❌ Ошибок: {fail_count}")
    print(f"📁 Файлы сохранены в: {OUTPUT_DIR}")
    print(f"\nТеперь запусти: npm run build && npm run deploy")

if __name__ == "__main__":
    print("=" * 60)
    print("🗺️  ГЕНЕРАТОР СТАТИЧЕСКИХ GEOJSON ФАЙЛОВ С ДОРОГАМИ")
    print("=" * 60)
    generate_road_files()
