$content = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Raw
$newBlock = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\fix_layout_regex.js" -Raw

$pattern = '(?s)  const renderLayoutActivo = \(container\) => \{.+?// Global tooltip functions'

$replacement = $newBlock + '      // Global tooltip functions'

$content = [regex]::Replace($content, $pattern, $replacement)
Set-Content -Path "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Value $content
Write-Host "Regex applied."
