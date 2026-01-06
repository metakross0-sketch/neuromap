#!/usr/bin/env python3
"""
Генерация миниатюр дорог для всех крупных городов России (300к+ населения)
Разбивает на файлы по ~19MB для загрузки на GitHub
"""

import requests
import json
import time
from pathlib import Path

# Города России 300к+ населения с координатами
MAJOR_CITIES = [
    # Миллионники
    {"name": "Москва", "lat": 55.7558, "lng": 37.6173, "pop": 12600000},
    {"name": "Санкт-Петербург", "lat": 59.9343, "lng": 30.3351, "pop": 5600000},
    {"name": "Новосибирск", "lat": 55.0084, "lng": 82.9357, "pop": 1633000},
    {"name": "Екатеринбург", "lat": 56.8389, "lng": 60.6057, "pop": 1544000},
    {"name": "Казань", "lat": 55.8304, "lng": 49.0661, "pop": 1308000},
    {"name": "Нижний Новгород", "lat": 56.2965, "lng": 43.9361, "pop": 1233000},
    {"name": "Челябинск", "lat": 55.1644, "lng": 61.4368, "pop": 1189000},
    {"name": "Самара", "lat": 53.2001, "lng": 50.1500, "pop": 1145000},
    {"name": "Омск", "lat": 54.9885, "lng": 73.3242, "pop": 1140000},
    {"name": "Ростов-на-Дону", "lat": 47.2357, "lng": 39.7015, "pop": 1142000},
    {"name": "Уфа", "lat": 54.7388, "lng": 55.9721, "pop": 1144000},
    {"name": "Красноярск", "lat": 56.0153, "lng": 92.8932, "pop": 1095000},
    {"name": "Воронеж", "lat": 51.6605, "lng": 39.2005, "pop": 1058000},
    {"name": "Пермь", "lat": 58.0105, "lng": 56.2502, "pop": 1055000},
    {"name": "Волгоград", "lat": 48.7080, "lng": 44.5133, "pop": 1004000},
    
    # 500к-1млн
    {"name": "Краснодар", "lat": 45.0355, "lng": 38.9753, "pop": 948000},
    {"name": "Саратов", "lat": 51.5924, "lng": 46.0348, "pop": 838000},
    {"name": "Тюмень", "lat": 57.1522, "lng": 65.5272, "pop": 816000},
    {"name": "Тольятти", "lat": 53.5303, "lng": 49.3461, "pop": 684000},
    {"name": "Ижевск", "lat": 56.8519, "lng": 53.2048, "pop": 646000},
    {"name": "Барнаул", "lat": 53.3547, "lng": 83.7697, "pop": 630000},
    {"name": "Ульяновск", "lat": 54.3142, "lng": 48.4031, "pop": 617000},
    {"name": "Иркутск", "lat": 52.2869, "lng": 104.3050, "pop": 623000},
    {"name": "Хабаровск", "lat": 48.4827, "lng": 135.0838, "pop": 617000},
    {"name": "Ярославль", "lat": 57.6261, "lng": 39.8845, "pop": 608000},
    {"name": "Владивосток", "lat": 43.1332, "lng": 131.9113, "pop": 600000},
    {"name": "Махачкала", "lat": 42.9849, "lng": 47.5047, "pop": 623000},
    {"name": "Томск", "lat": 56.4977, "lng": 84.9744, "pop": 576000},
    {"name": "Оренбург", "lat": 51.7727, "lng": 55.0988, "pop": 572000},
    {"name": "Кемерово", "lat": 55.3547, "lng": 86.0586, "pop": 556000},
    {"name": "Новокузнецк", "lat": 53.7596, "lng": 87.1216, "pop": 537000},
    {"name": "Рязань", "lat": 54.6269, "lng": 39.6916, "pop": 540000},
    {"name": "Астрахань", "lat": 46.3497, "lng": 48.0408, "pop": 524000},
    {"name": "Набережные Челны", "lat": 55.7430, "lng": 52.3977, "pop": 533000},
    {"name": "Пенза", "lat": 53.2007, "lng": 45.0046, "pop": 520000},
    {"name": "Киров", "lat": 58.6035, "lng": 49.6680, "pop": 518000},
    
    # 300к-500к
    {"name": "Липецк", "lat": 52.6103, "lng": 39.5698, "pop": 496000},
    {"name": "Чебоксары", "lat": 56.1439, "lng": 47.2489, "pop": 497000},
    {"name": "Калининград", "lat": 54.7104, "lng": 20.4522, "pop": 489000},
    {"name": "Тула", "lat": 54.1961, "lng": 37.6182, "pop": 468000},
    {"name": "Курск", "lat": 51.7373, "lng": 36.1873, "pop": 450000},
    {"name": "Ставрополь", "lat": 45.0428, "lng": 41.9734, "pop": 450000},
    {"name": "Сочи", "lat": 43.6028, "lng": 39.7342, "pop": 443000},
    {"name": "Улан-Удэ", "lat": 51.8272, "lng": 107.6063, "pop": 439000},
    {"name": "Тверь", "lat": 56.8587, "lng": 35.9176, "pop": 425000},
    {"name": "Магнитогорск", "lat": 53.4117, "lng": 58.9794, "pop": 410000},
    {"name": "Иваново", "lat": 57.0000, "lng": 40.9737, "pop": 401000},
    {"name": "Брянск", "lat": 53.2521, "lng": 34.3717, "pop": 400000},
    {"name": "Белгород", "lat": 50.5997, "lng": 36.5982, "pop": 392000},
    {"name": "Нижний Тагил", "lat": 57.9197, "lng": 59.9650, "pop": 338000},
    {"name": "Архангельск", "lat": 64.5401, "lng": 40.5433, "pop": 346000},
    {"name": "Владимир", "lat": 56.1366, "lng": 40.3966, "pop": 349000},
    {"name": "Калуга", "lat": 54.5293, "lng": 36.2754, "pop": 361000},
    {"name": "Чита", "lat": 52.0330, "lng": 113.4994, "pop": 349000},
    {"name": "Смоленск", "lat": 54.7818, "lng": 32.0401, "pop": 320000},
    {"name": "Волжский", "lat": 48.7854, "lng": 44.7511, "pop": 323000},
    {"name": "Курган", "lat": 55.4500, "lng": 65.3333, "pop": 310000},
    {"name": "Череповец", "lat": 59.1333, "lng": 37.9000, "pop": 306000},
    {"name": "Орёл", "lat": 52.9651, "lng": 36.0785, "pop": 302000},
    {"name": "Вологда", "lat": 59.2239, "lng": 39.8843, "pop": 301000},
]

def get_city_roads(city_name: str, lat: float, lng: float, buffer: float = 0.15) -> dict:
    """
    Загружает trunk и primary дороги для города
    buffer = 0.15 градуса ≈ 15-17км радиус
    """
    south = lat - buffer
    north = lat + buffer
    west = lng - buffer
    east = lng + buffer
    
    bbox = f"{south},{west},{north},{east}"
    
    query = f"""
    [out:json][timeout:90];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]["highway"!~".*_link"]({bbox});
    );
    out geom;
    """
    
    print(f"📡 Загружаю {city_name}...")
    
    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            timeout=120
        )
        
        if response.status_code == 200:
            data = response.json()
            roads_count = len(data.get("elements", []))
            print(f"   ✅ {city_name}: {roads_count} дорог")
            return data
        else:
            print(f"   ❌ {city_name}: HTTP {response.status_code}")
            return {"elements": []}
            
    except Exception as e:
        print(f"   ❌ {city_name}: {str(e)}")
        return {"elements": []}

def convert_to_geojson(city_name: str, osm_data: dict) -> list:
    """
    Конвертирует OSM данные в GeoJSON features
    Добавляет city в properties для идентификации
    """
    features = []
    
    for element in osm_data.get("elements", []):
        if element["type"] != "way" or "geometry" not in element:
            continue
            
        coordinates = [
            [node["lon"], node["lat"]] 
            for node in element["geometry"]
        ]
        
        if len(coordinates) < 2:
            continue
        
        feature = {
            "type": "Feature",
            "properties": {
                "highway": element.get("tags", {}).get("highway", "unknown"),
                "city": city_name,
                "name": element.get("tags", {}).get("name", "")
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            }
        }
        
        features.append(feature)
    
    return features

def split_into_parts(features: list, max_size_mb: float = 19.0) -> list:
    """
    Разбивает features на части по max_size_mb мегабайт
    """
    parts = []
    current_part = []
    current_size = 0
    
    for feature in features:
        feature_json = json.dumps(feature, ensure_ascii=False)
        feature_size = len(feature_json.encode('utf-8')) / (1024 * 1024)  # MB
        
        if current_size + feature_size > max_size_mb and current_part:
            parts.append(current_part)
            current_part = []
            current_size = 0
        
        current_part.append(feature)
        current_size += feature_size
    
    if current_part:
        parts.append(current_part)
    
    return parts

def main():
    print("🗺️  Генерация миниатюр городов России 300к+")
    print(f"📊 Всего городов: {len(MAJOR_CITIES)}")
    print("=" * 60)
    
    all_features = []
    
    # Загружаем данные для каждого города
    for i, city in enumerate(MAJOR_CITIES, 1):
        print(f"\n[{i}/{len(MAJOR_CITIES)}] {city['name']} ({city['pop']:,} чел.)")
        
        osm_data = get_city_roads(city['name'], city['lat'], city['lng'])
        features = convert_to_geojson(city['name'], osm_data)
        all_features.extend(features)
        
        print(f"   💾 Добавлено {len(features)} дорог")
        
        # Пауза между запросами чтобы не перегрузить Overpass API
        if i < len(MAJOR_CITIES):
            time.sleep(2)
    
    print("\n" + "=" * 60)
    print(f"✅ Всего загружено дорог: {len(all_features)}")
    
    # Создаём GeoJSON FeatureCollection
    geojson = {
        "type": "FeatureCollection",
        "features": all_features
    }
    
    # Сохраняем полную версию
    output_dir = Path("public/roads/russia-cities")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    full_path = output_dir / "all-cities-full.geojson"
    with open(full_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    full_size = full_path.stat().st_size / (1024 * 1024)
    print(f"\n💾 Полная версия: {full_path}")
    print(f"   Размер: {full_size:.2f} MB")
    
    # Разбиваем на части
    print(f"\n📦 Разбиваю на части по ~19MB...")
    parts = split_into_parts(all_features, max_size_mb=19.0)
    
    for i, part_features in enumerate(parts, 1):
        part_geojson = {
            "type": "FeatureCollection",
            "features": part_features
        }
        
        part_path = output_dir / f"part-{i}.geojson"
        with open(part_path, 'w', encoding='utf-8') as f:
            json.dump(part_geojson, f, ensure_ascii=False)
        
        part_size = part_path.stat().st_size / (1024 * 1024)
        print(f"   ✅ part-{i}.geojson: {len(part_features)} дорог, {part_size:.2f} MB")
    
    print("\n" + "=" * 60)
    print(f"🎉 Готово! Создано {len(parts)} файлов")
    print(f"📂 Папка: {output_dir}")

if __name__ == "__main__":
    main()
