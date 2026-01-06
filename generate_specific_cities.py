#!/usr/bin/env python3
"""
Скрипт для генерации GeoJSON файлов только для указанных городов
"""

import requests
import json
import os
import time
from pathlib import Path

# URL к Flask API
FLASK_API_URL = "https://chronosphere.pythonanywhere.com"

# Overpass серверы
OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
]

# Папка для сохранения
OUTPUT_DIR = Path(__file__).parent / "public" / "roads"

# ГОРОДА ДЛЯ ОБРАБОТКИ
CITIES_TO_PROCESS = ['Ivdel']

def slugify(text):
    """Преобразует название города в slug"""
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

def get_shops_for_city(city_name):
    """Получает магазины города"""
    try:
        print(f"   📡 Загружаем магазины...")
        response = requests.get(f"{FLASK_API_URL}/api/shops/{city_name}", timeout=30)
        data = response.json()
        return data.get('shops', [])
    except Exception as e:
        print(f"   ❌ Ошибка получения магазинов: {e}")
        return []

def calculate_bbox(shops, buffer_km=30):
    """Вычисляет bbox вокруг магазинов"""
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
    [out:json][timeout:120];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|road|service|living_street|footway|path|track|cycleway|pedestrian"]["highway"!~".*_link"]({bbox});
    );
    out geom;
    """
    
    server = OVERPASS_SERVERS[server_index % len(OVERPASS_SERVERS)]
    
    try:
        print(f"   🌐 Запрос к {server.split('/')[2]}...")
        response = requests.post(server, data=query, timeout=150)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            print(f"   ⚠️ Rate limit, ждем 10 сек...")
            time.sleep(10)
            return None
        else:
            print(f"   ❌ Ошибка {response.status_code}")
            return None
    except requests.exceptions.Timeout:
        print(f"   ⏱️ Timeout (>150 сек)")
        return None
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        return None

def generate_for_cities():
    """Генерирует GeoJSON файлы для указанных городов"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Папка: {OUTPUT_DIR}\n")
    
    success_count = 0
    
    for i, city_name in enumerate(CITIES_TO_PROCESS, 1):
        print(f"\n[{i}/{len(CITIES_TO_PROCESS)}] 🏙️ {city_name}")
        
        # Получаем магазины
        shops = get_shops_for_city(city_name)
        if not shops:
            print(f"   ⚠️ Нет магазинов, пропускаем")
            continue
        
        print(f"   📍 Магазинов: {len(shops)}")
        
        # Вычисляем bbox
        bbox = calculate_bbox(shops, buffer_km=20)
        if not bbox:
            print(f"   ❌ Не удалось вычислить bbox")
            continue
        
        coords = bbox.split(',')
        area = f"{(float(coords[2]) - float(coords[0])) * 111:.1f}×{(float(coords[3]) - float(coords[1])) * 111:.1f}км"
        print(f"   📏 Область: {area}")
        
        # Пробуем разные серверы
        data = None
        for attempt in range(len(OVERPASS_SERVERS)):
            print(f"   🔄 Попытка {attempt + 1}/{len(OVERPASS_SERVERS)}...")
            data = fetch_roads(bbox, server_index=attempt)
            if data:
                break
            print(f"   ⏸️ Пауза 5 сек перед следующей попыткой...")
            time.sleep(5)
        
        if not data or not data.get('elements'):
            print(f"   ❌ Не удалось загрузить дороги")
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
        
        # Пауза между городами
        if i < len(CITIES_TO_PROCESS):
            print(f"   ⏸️ Пауза 10 сек...")
            time.sleep(10)
    
    print(f"\n{'='*60}")
    print(f"✅ Успешно сгенерировано: {success_count}/{len(CITIES_TO_PROCESS)}")
    print(f"📁 Файлы: {OUTPUT_DIR}")
    
    if success_count > 0:
        print(f"\n🚀 Теперь запусти:")
        print(f"   cd ..")
        print(f"   npm run build")
        print(f"   npm run deploy")

if __name__ == "__main__":
    print("="*60)
    print("🗺️  ГЕНЕРАТОР ДЛЯ НОВЫХ ГОРОДОВ")
    print("="*60)
    print(f"Города: {', '.join(CITIES_TO_PROCESS)}\n")
    generate_for_cities()
