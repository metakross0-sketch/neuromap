import { useState, useEffect } from 'preact/hooks';
import { api } from '../api/client';
import type { Shop } from '../types';

interface ShopInfoProps {
  shop: Shop;
  onClose: () => void;
}

export function ShopInfo({ shop, onClose }: ShopInfoProps) {
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'sections' | 'categories' | 'models' | 'submodels' | 'products'>('sections');

  useEffect(() => {
    // Загрузка каталога магазина
    api.getShopCatalog(shop.id).then(data => {
      setCatalog(data.catalog || null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [shop.id]);

  // Подсчет количества товаров
  const countItems = (obj: any): number => {
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj !== 'object' || obj === null) return 0;
    return Object.values(obj).reduce((sum: number, val) => sum + countItems(val), 0);
  };

  const handleBack = () => {
    if (navigationPath.length === 0) {
      onClose();
    } else {
      const newPath = [...navigationPath];
      newPath.pop();
      setNavigationPath(newPath);
      
      if (newPath.length === 0) setCurrentView('sections');
      else if (newPath.length === 1) setCurrentView('categories');
      else if (newPath.length === 2) setCurrentView('models');
      else if (newPath.length === 3) setCurrentView('submodels');
    }
  };

  const renderSections = () => {
    if (!catalog) return null;
    return Object.keys(catalog).map((section) => {
      const count = countItems(catalog[section]);
      return (
        <div key={section} className="category-card" onClick={() => {
          setNavigationPath([section]);
          setCurrentView('categories');
        }}>
          <h3>{section}</h3>
          <div className="count">{count} {count === 1 ? 'товар' : 'товаров'}</div>
        </div>
      );
    });
  };

  const renderCategories = () => {
    if (!catalog) return null;
    const section = navigationPath[0];
    return Object.keys(catalog[section]).map((category) => {
      const count = countItems(catalog[section][category]);
      return (
        <div key={category} className="category-card" onClick={() => {
          setNavigationPath([section, category]);
          setCurrentView('models');
        }}>
          <h3>{category}</h3>
          <div className="count">{count} {count === 1 ? 'товар' : 'товаров'}</div>
        </div>
      );
    });
  };

  const renderModels = () => {
    if (!catalog) return null;
    const [section, category] = navigationPath;
    return Object.keys(catalog[section][category]).map((model) => {
      const modelData = catalog[section][category][model];
      const submodels = Object.keys(modelData);
      const count = countItems(modelData);
      
      if (submodels.length === 1 && submodels[0] === "") {
        return (
          <div key={model} className="category-card" onClick={() => {
            setNavigationPath([section, category, model]);
            setCurrentView('products');
          }}>
            <h3>{model}</h3>
            <div className="count">{count} {count === 1 ? 'товар' : 'товаров'}</div>
          </div>
        );
      }
      
      return (
        <div key={model} className="category-card" onClick={() => {
          setNavigationPath([section, category, model]);
          setCurrentView('submodels');
        }}>
          <h3>{model}</h3>
          <div className="count">{count} {count === 1 ? 'товар' : 'товаров'}</div>
        </div>
      );
    });
  };

  const renderSubmodels = () => {
    if (!catalog) return null;
    const [section, category, model] = navigationPath;
    return Object.keys(catalog[section][category][model]).map((submodel) => {
      const products = catalog[section][category][model][submodel];
      const count = products.length;
      return (
        <div key={submodel} className="category-card" onClick={() => {
          setNavigationPath(submodel === "" ? [section, category, model] : [section, category, model, submodel]);
          setCurrentView('products');
        }}>
          <h3>{submodel || 'Все модели'}</h3>
          <div className="count">{count} {count === 1 ? 'товар' : 'товаров'}</div>
        </div>
      );
    });
  };

  const renderProducts = () => {
    if (!catalog) return null;
    const [section, category, model, submodel = ""] = navigationPath;
    const products = catalog[section][category][model][submodel];
    
    if (!products || products.length === 0) {
      return <div className="empty-state">Товары не найдены</div>;
    }

    return products.map((item: any, idx: number) => (
      <div key={idx} className="catalog-item">
        {item.photo_url && (
          <img 
            src={item.photo_url} 
            alt={item.color || 'Товар'} 
            className="catalog-item__photo"
          />
        )}
        <div className="catalog-item__info">
          <span className="catalog-item__name">{item.color || 'Без названия'}</span>
          {item.user_description && <span className="catalog-item__desc">{item.user_description}</span>}
        </div>
        <span className="catalog-item__price">{item.price || 'Цена не указана'}</span>
      </div>
    ));
  };

  const photoUrl = shop.photo_url 
    ? `https://raw.githubusercontent.com/metakross0-sketch/chronosphere_app/main/images/${shop.photo_url}`
    : null;

  return (
    <div className="shop-info" onClick={onClose}>
      <div className="shop-info__content" onClick={(e) => e.stopPropagation()}>
        <div className="shop-info__header">
          <button className="shop-info__back" onClick={handleBack}>←</button>
          <h2 className="shop-info__name">{shop.name}</h2>
          <button className="shop-info__close" onClick={onClose}>✕</button>
        </div>

        {navigationPath.length > 0 && (
          <div className="breadcrumb">
            {navigationPath.map((item, idx) => (
              <span key={idx}>{item} / </span>
            ))}
          </div>
        )}

        {photoUrl && (
          <div className="shop-info__photo">
            <img 
              src={photoUrl}
              alt={shop.name}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}

        {navigationPath.length === 0 && (
          <div className="shop-info__details">
            <div className="shop-info__row">
              <span className="label">Категория:</span>
              <span className="value">{shop.category}</span>
            </div>
            <div className="shop-info__row">
              <span className="label">Активность:</span>
              <span className="value">{Math.round((shop.activity || 0) * 100)}%</span>
            </div>
          </div>
        )}

        <div className="shop-info__catalog-section">
          {loading ? (
            <div className="shop-info__loading">Загрузка каталога...</div>
          ) : catalog && Object.keys(catalog).length > 0 ? (
            <div className="shop-info__grid">
              {currentView === 'sections' && renderSections()}
              {currentView === 'categories' && renderCategories()}
              {currentView === 'models' && renderModels()}
              {currentView === 'submodels' && renderSubmodels()}
              {currentView === 'products' && renderProducts()}
            </div>
          ) : (
            <div className="shop-info__empty">Каталог пуст или не загружен</div>
          )}
        </div>
      </div>
    </div>
  );
}
