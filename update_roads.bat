@echo off
chcp 65001 >nul
echo Уменьшаем толщину оранжевых линий...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$file='src\components\MapView.tsx'; $content=Get-Content $file -Raw -Encoding UTF8; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 5, 8, 10, 20, 16, 40\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 6, 10, 14, 16, 28]\"; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 5, 4, 10, 10, 16, 20\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 3, 10, 7, 16, 14]\"; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 8, 6, 12, 15, 16, 30\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 4, 12, 11, 16, 21]\"; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 8, 3, 12, 8, 16, 16\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 2, 12, 6, 16, 11]\"; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 12, 4, 16, 16\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 3, 16, 11]\"; $content=$content -replace \"'line-width': \['interpolate', \['exponential', 1\.6\], \['zoom'\], 12, 2, 16, 8\]\",\"'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1.5, 16, 6]\"; Set-Content $file $content -Encoding UTF8 -NoNewline"

echo.
echo Готово! Толщина линий уменьшена на 30%%
echo.
echo Теперь запусти:
echo python generate_roads.py
echo npm run deploy
pause
