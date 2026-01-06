# Заменяем ВСЕ оставшиеся цианые цвета на ярко-белый холодный

$files = @(
    "src\style.css"
)

$replacements = @{
    "#0ff" = "#f0f8ff"
    "#00ffff" = "#f0f8ff"
    "rgb(0, 255, 255)" = "rgb(240, 248, 255)"
    "rgba(0, 255, 255" = "rgba(240, 248, 255"
}

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Обрабатываем $file..."
        $content = Get-Content $file -Raw -Encoding UTF8
        
        foreach ($old in $replacements.Keys) {
            $new = $replacements[$old]
            if ($content -match [regex]::Escape($old)) {
                Write-Host "  - Заменяем '$old' на '$new'"
                $content = $content -replace [regex]::Escape($old), $new
            }
        }
        
        Set-Content $file -Value $content -Encoding UTF8 -NoNewline
        Write-Host "✓ $file обновлен"
    } else {
        Write-Host "⚠ Файл не найден: $file"
    }
}

Write-Host "`n✅ Все цвета заменены!"
