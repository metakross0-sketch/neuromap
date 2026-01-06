// Telegram WebApp API helper

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        platform: string;
        initData: string;
        initDataUnsafe: any;
      };
    };
  }
}

export const tg = window.Telegram?.WebApp;

// Инициализация TMA
export function initTelegramApp() {
  if (!tg) {
    console.warn('Telegram WebApp is not available');
    return false;
  }

  // Разворачиваем приложение на весь экран
  tg.ready();
  tg.expand();

  // Применяем тему Telegram
  if (tg.themeParams.bg_color) {
    document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
  }
  if (tg.themeParams.text_color) {
    document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
  }

  console.log('Telegram WebApp initialized:', {
    platform: tg.platform,
    colorScheme: tg.colorScheme,
    isExpanded: tg.isExpanded,
  });

  return true;
}

// Геолокация через Telegram (fallback на браузер)
export function requestLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (tg) {
      // Telegram не предоставляет прямой API для геолокации
      // Используем браузерный API как fallback
      console.log('Using browser geolocation API');
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      reject(new Error('Geolocation is not supported'));
    }
  });
}

// Haptic feedback
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection') {
  if (!tg?.HapticFeedback) return;

  switch (type) {
    case 'light':
    case 'medium':
    case 'heavy':
      tg.HapticFeedback.impactOccurred(type);
      break;
    case 'success':
    case 'warning':
    case 'error':
      tg.HapticFeedback.notificationOccurred(type);
      break;
    case 'selection':
      tg.HapticFeedback.selectionChanged();
      break;
  }
}

// Показать кнопку "Назад"
export function showBackButton(callback: () => void) {
  if (!tg?.BackButton) return;
  
  tg.BackButton.onClick(callback);
  tg.BackButton.show();
}

// Скрыть кнопку "Назад"
export function hideBackButton(callback?: () => void) {
  if (!tg?.BackButton) return;
  
  if (callback) {
    tg.BackButton.offClick(callback);
  }
  tg.BackButton.hide();
}

// Показать главную кнопку
export function showMainButton(text: string, callback: () => void, color?: string) {
  if (!tg?.MainButton) return;

  tg.MainButton.setText(text);
  if (color) {
    tg.MainButton.color = color;
  }
  tg.MainButton.onClick(callback);
  tg.MainButton.show();
}

// Скрыть главную кнопку
export function hideMainButton(callback?: () => void) {
  if (!tg?.MainButton) return;

  if (callback) {
    tg.MainButton.offClick(callback);
  }
  tg.MainButton.hide();
}

// Закрыть приложение
export function closeApp() {
  if (!tg) return;
  tg.close();
}

// Проверка, запущено ли в Telegram
export function isTelegramWebApp(): boolean {
  return !!tg;
}
