$content = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Raw
$newBlock = Get-Content "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\fix_layout.js" -Raw

$startTag = '  const renderLayoutActivo = (container) => {'
$endTag = '        let gridHtml = ' + [char]96

$startIndex = $content.IndexOf($startTag)
$endIndex = $content.IndexOf($endTag, $startIndex)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $before = $content.Substring(0, $startIndex)
    $after = $content.Substring($endIndex)
    
    $content = $before + $newBlock + "

" + $after
    Set-Content -Path "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js" -Value $content
    Write-Host "Replaced successfully."
} else {
    Write-Host "Bounds not found."
}
