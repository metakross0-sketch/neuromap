#!/usr/bin/env python3
"""
Генерация белых линий между городами России (только 3 ближайших соседа)
Использует OSRM публичный API, но сохраняет результаты в статический файл
"""

import json
import math
import time
from pathlib import Path
import requests
from datetime import datetime

# Те же города что и в generate_russia_cities.py
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
    {"name": "Пенза", "lat": 53.2001, "lng": 45.0047, "pop": 520000},
    {"name": "Киров", "lat": 58.6035, "lng": 49.6680, "pop": 521000},
    
    # 300к-500к
    {"name": "Липецк", "lat": 52.6108, "lng": 39.5928, "pop": 496000},
    {"name": "Чебоксары", "lat": 56.1439, "lng": 47.2489, "pop": 497000},
    {"name": "Калининград", "lat": 54.7065, "lng": 20.5110, "pop": 489000},
    {"name": "Тула", "lat": 54.1961, "lng": 37.6182, "pop": 475000},
    {"name": "Курск", "lat": 51.7373, "lng": 36.1873, "pop": 450000},
    {"name": "Ставрополь", "lat": 45.0428, "lng": 41.9734, "pop": 547000},
    {"name": "Сочи", "lat": 43.5855, "lng": 39.7231, "pop": 466000},
    {"name": "Улан-Удэ", "lat": 51.8272, "lng": 107.6063, "pop": 439000},
    {"name": "Тверь", "lat": 56.8587, "lng": 35.9176, "pop": 425000},
    {"name": "Магнитогорск", "lat": 53.4181, "lng": 58.9797, "pop": 413000},
    {"name": "Иваново", "lat": 57.0000, "lng": 40.9737, "pop": 381000},
    {"name": "Брянск", "lat": 53.2521, "lng": 34.3717, "pop": 379000},
    {"name": "Белгород", "lat": 50.5997, "lng": 36.5988, "pop": 339000},
    {"name": "Нижний Тагил", "lat": 57.9191, "lng": 59.9650, "pop": 338000},
    {"name": "Архангельск", "lat": 64.5401, "lng": 40.5433, "pop": 301000},
    {"name": "Владимир", "lat": 56.1366, "lng": 40.3966, "pop": 349000},
    {"name": "Калуга", "lat": 54.5293, "lng": 36.2754, "pop": 361000},
    {"name": "Чита", "lat": 52.0330, "lng": 113.4994, "pop": 349000},
    {"name": "Смоленск", "lat": 54.7818, "lng": 32.0401, "pop": 320000},
    {"name": "Волжский", "lat": 48.7854, "lng": 44.7511, "pop": 323000},
    {"name": "Курган", "lat": 55.4500, "lng": 65.3333, "pop": 310000},
    {"name": "Череповец", "lat": 59.1333, "lng": 37.9000, "pop": 306000},
    {"name": "Орёл", "lat": 52.9651, "lng": 36.0785, "pop": 302000},
    {"name": "Вологда", "lat": 59.2239, "lng": 39.8843, "pop": 301000},
    
    # Север и Северо-Запад
    {"name": "Мурманск", "lat": 68.9585, "lng": 33.0827, "pop": 270000},
    {"name": "Петрозаводск", "lat": 61.7849, "lng": 34.3469, "pop": 280000},
    {"name": "Сыктывкар", "lat": 61.6681, "lng": 50.8372, "pop": 245000},
    {"name": "Северодвинск", "lat": 64.5635, "lng": 39.8302, "pop": 180000},
    {"name": "Великий Новгород", "lat": 58.5218, "lng": 31.2755, "pop": 225000},
    {"name": "Псков", "lat": 57.8136, "lng": 28.3496, "pop": 210000},
    {"name": "Петропавловск-Камчатский", "lat": 53.0245, "lng": 158.6433, "pop": 180000},
    {"name": "Норильск", "lat": 69.3558, "lng": 88.1893, "pop": 180000},
    {"name": "Нарьян-Мар", "lat": 67.6380, "lng": 53.0069, "pop": 25000},
    {"name": "Салехард", "lat": 66.5297, "lng": 66.6139, "pop": 50000},
    
    # Дальний Восток и Сибирь
    {"name": "Якутск", "lat": 62.0355, "lng": 129.6755, "pop": 320000},
    {"name": "Благовещенск", "lat": 50.2903, "lng": 127.5270, "pop": 225000},
    {"name": "Южно-Сахалинск", "lat": 46.9590, "lng": 142.7386, "pop": 200000},
    {"name": "Магадан", "lat": 59.5606, "lng": 150.8102, "pop": 92000},
    {"name": "Комсомольск-на-Амуре", "lat": 50.5497, "lng": 137.0108, "pop": 240000},
    {"name": "Находка", "lat": 42.8167, "lng": 132.8736, "pop": 150000},
    {"name": "Абакан", "lat": 53.7215, "lng": 91.4425, "pop": 187000},
    {"name": "Братск", "lat": 56.1515, "lng": 101.6340, "pop": 220000},
    {"name": "Ангарск", "lat": 52.5379, "lng": 103.8886, "pop": 220000},
    {"name": "Усть-Илимск", "lat": 58.0006, "lng": 102.6619, "pop": 80000},
    {"name": "Анадырь", "lat": 64.7340, "lng": 177.4970, "pop": 15000},
    {"name": "Южно-Курильск", "lat": 44.0311, "lng": 145.8636, "pop": 7000},
]

def haversine_distance(lat1, lng1, lat2, lng2):
    """Вычисляет расстояние между двумя точками в км"""
    R = 6371  # радиус Земли в км
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def find_nearest_neighbors(cities, k=3):
    """Находит k ближайших соседей для каждого города"""
    neighbors = {}
    
    for i, city in enumerate(cities):
        distances = []
        for j, other in enumerate(cities):
            if i != j:
                dist = haversine_distance(
                    city['lat'], city['lng'],
                    other['lat'], other['lng']
                )
                distances.append((j, dist, other['name']))
        
        distances.sort(key=lambda x: x[1])
        neighbors[city['name']] = distances[:k]
    
    return neighbors

def get_route_geometry(from_city, to_city):
    """Получает геометрию маршрута между городами через OSRM"""
    try:
        print(f"   🛣️  {from_city['name']} → {to_city['name']}...", end='', flush=True)
        
        # OSRM запрос
        url = f"https://router.project-osrm.org/route/v1/driving/{from_city['lng']},{from_city['lat']};{to_city['lng']},{to_city['lat']}"
        params = {
            'overview': 'full',
            'geometries': 'geojson'
        }
        
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 'Ok' and data.get('routes'):
                route = data['routes'][0]
                coords = route['geometry']['coordinates']
                
                print(f" ✅ {len(coords)} точек")
                
                return {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords
                    },
                    "properties": {
                        "from": from_city['name'],
                        "to": to_city['name'],
                        "distance_km": route['distance'] / 1000,
                        "duration_min": route['duration'] / 60
                    }
                }
        
        print(f" ❌ HTTP {response.status_code}")
        return None
        
    except Exception as e:
        print(f" ❌ {str(e)[:50]}")
        return None

def main():
    print("🗺️  Генерация межгородских дорог России")
    print(f"📊 Всего городов: {len(MAJOR_CITIES)}")
    print("=" * 60)
    
    # Находим 3 ближайших соседа для каждого города
    print("\n🔍 Поиск ближайших соседей...")
    neighbors = find_nearest_neighbors(MAJOR_CITIES, k=3)
    
    total_routes = sum(len(n) for n in neighbors.values()) // 2  # делим на 2 т.к. считаем пары дважды
    print(f"📍 Будет построено ~{total_routes} маршрутов")
    
    # Генерируем маршруты
    print("\n🛣️  Построение маршрутов...")
    print("⚠️  Задержка 2 секунды между запросами чтобы не перегрузить OSRM")
    features = []
    processed_pairs = set()
    success_count = 0
    
    for city_name, nearest in neighbors.items():
        city = next(c for c in MAJOR_CITIES if c['name'] == city_name)
        
        for neighbor_idx, distance_km, neighbor_name in nearest:
            # Избегаем дублирования (A→B и B→A)
            pair = tuple(sorted([city_name, neighbor_name]))
            if pair in processed_pairs:
                continue
            processed_pairs.add(pair)
            
            neighbor = MAJOR_CITIES[neighbor_idx]
            
            # Пытаемся построить маршрут
            route = get_route_geometry(city, neighbor)
            if route:
                features.append(route)
                success_count += 1
            
            # Задержка между запросами
            time.sleep(2)
    
    print("\n" + "=" * 60)
    print(f"✅ Успешно построено маршрутов: {success_count}")
    print(f"❌ Не удалось построить: {total_routes - success_count}")
    
    # Сохраняем в GeoJSON
    output_dir = Path("public/roads/russia-cities")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated": datetime.now().isoformat(),
            "total_routes": len(features),
            "cities": len(MAJOR_CITIES)
        }
    }
    
    output_path = output_dir / "inter-city-roads.geojson"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    file_size = output_path.stat().st_size / (1024 * 1024)
    print(f"\n💾 Сохранено: {output_path}")
    print(f"   Размер: {file_size:.2f} MB")
    print(f"   Маршрутов: {len(features)}")
    print("\n🎉 Готово!")
    print(f"\n💡 Теперь нужно обновить MapView.tsx чтобы загружать этот файл")

if __name__ == "__main__":
    main()
