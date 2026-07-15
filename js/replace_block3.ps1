$content = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Raw
$newBlock = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\fix_layout.js" -Raw

$pattern = '(?s)const renderLayoutActivo = \(container\) => \{.+?let gridHtml = ' + [char]96

$replacement = $newBlock + 'let gridHtml = ' + [char]96

$content = [regex]::Replace($content, $pattern, $replacement)
Set-Content -Path "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Value $content
Write-Host "Regex applied."
