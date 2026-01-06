import gspread
from google.oauth2.service_account import Credentials
import re

# Настройки
GOOGLE_SHEETS_CREDS = 'service_account.json'
MAIN_SPREADSHEET_ID = '13OZWPfVx5IWvKWOKzvZEwGbDeAuqmku_jGCvpSujpoQ'

def get_shops_coordinates():
    """Получение координат всех магазинов из Google Sheets"""
    try:
        scope = ['https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/spreadsheets']

        creds = Credentials.from_service_account_file(GOOGLE_SHEETS_CREDS, scopes=scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(MAIN_SPREADSHEET_ID)
        sheet = spreadsheet.sheet1

        data = sheet.get('A2:G1000')
        
        shops = []
        for row in data:
            if len(row) >= 4 and row[1] and row[3]:  # Есть название и ID
                shop_id = row[3]
                shop_name = row[1]
                
                # Парсим координаты из ссылки 2ГИС
                latitude, longitude, city = None, None, 'Не установлен'
                
                if len(row) > 4 and row[4]:  # Ссылка 2ГИС в столбце E
                    coords_match = re.search(r'm=([0-9.]+)(?:%2C|,)([0-9.]+)', row[4])
                    if coords_match:
                        longitude = float(coords_match.group(1))
                        latitude = float(coords_match.group(2))
                        
                        # Определяем город из URL
                        city_match = re.search(r'2gis\.ru/([^/]+)/', row[4])
                        if city_match:
                            city = city_match.group(1)
                
                if latitude and longitude:
                    shops.append({
                        'shop_id': shop_id,
                        'shop_name': shop_name,
                        'city': city,
                        'latitude': latitude,
                        'longitude': longitude
                    })
        
        return shops
    except Exception as e:
        print(f"Ошибка чтения Google Sheets: {e}")
        return []

def find_duplicate_coordinates(shops):
    """Поиск магазинов с одинаковыми координатами"""
    coord_groups = {}
    
    for shop in shops:
        # Округляем до 6 знаков после запятой (~10см точность)
        key = f"{shop['latitude']:.6f}_{shop['longitude']:.6f}"
        
        if key not in coord_groups:
            coord_groups[key] = []
        coord_groups[key].append(shop)
    
    # Фильтруем только группы с дубликатами
    duplicates = {k: v for k, v in coord_groups.items() if len(v) > 1}
    
    return duplicates, coord_groups

def main():
    print("Загрузка данных из Google Sheets...")
    shops = get_shops_coordinates()
    
    print(f"\nВсего магазинов с координатами: {len(shops)}")
    print("\n" + "="*80)
    
    duplicates, all_groups = find_duplicate_coordinates(shops)
    
    if duplicates:
        print(f"\n🔴 Найдено {len(duplicates)} точек с несколькими магазинами:")
        print("="*80)
        
        for coord, group in duplicates.items():
            lat, lng = coord.split('_')
            print(f"\n📍 Координаты: {lat}, {lng}")
            print(f"   Количество магазинов в этой точке: {len(group)}")
            print(f"   Магазины:")
            for shop in group:
                print(f"   - {shop['shop_name']} (ID: {shop['shop_id']}, Город: {shop['city']})")
    else:
        print("\n✅ Все магазины имеют уникальные координаты")
    
    print("\n" + "="*80)
    print("\nВсе магазины по координатам:")
    print("="*80)
    
    for i, (coord, group) in enumerate(all_groups.items(), 1):
        lat, lng = coord.split('_')
        if len(group) > 1:
            marker = "🔴"
        else:
            marker = "✅"
        
        shop = group[0]
        print(f"{marker} {i}. {shop['shop_name']} (ID: {shop['shop_id']})")
        print(f"   Координаты: {lat}, {lng}")
        print(f"   Город: {shop['city']}")
        
        if len(group) > 1:
            print(f"   ⚠️ В этой же точке еще {len(group)-1} магазин(ов):")
            for other_shop in group[1:]:
                print(f"      - {other_shop['shop_name']} (ID: {other_shop['shop_id']})")
        print()

if __name__ == '__main__':
    main()
