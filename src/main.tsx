import { render } from 'preact';
import { App } from './App';
import './style.css';
import { initTelegramApp } from './utils/telegram';

// Инициализация Telegram Mini App
initTelegramApp();

render(<App />, document.getElementById('app')!);
