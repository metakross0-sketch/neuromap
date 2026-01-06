@echo off
chcp 65001 >nul
echo Заменяем ВСЕ циановые цвета на яркий холодный белый...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$files=@('src\style.css','src\components\NeuralMap.tsx','src\components\CategorySelector.tsx'); foreach($file in $files){if(Test-Path $file){$content=Get-Content $file -Raw -Encoding UTF8; $content=$content -replace '#00ffff','#f0f8ff'; $content=$content -replace 'rgba\(0,\s*255,\s*255','rgba(240, 248, 255'; $content=$content -replace 'rgb\(0,\s*255,\s*255','rgb(240, 248, 255'; Set-Content $file $content -Encoding UTF8 -NoNewline; Write-Host \"✅ $file обновлен\" -ForegroundColor Green}}"

echo.
echo ✅ Все циановые цвета заменены на #f0f8ff!
echo.
pause
