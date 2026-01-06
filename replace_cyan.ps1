# Заменяем циан на холодный белый
$file = "src\components\MapView.tsx"
$content = Get-Content $file -Raw -Encoding UTF8
$content = $content -replace '#00ffff', '#e8f4f8'
$content = $content -replace 'rgba\(0, 255, 255,', 'rgba(232, 244, 248,'
Set-Content $file $content -Encoding UTF8 -NoNewline
Write-Host "Замена завершена!" -ForegroundColor Green
