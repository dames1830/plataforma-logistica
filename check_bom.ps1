$file = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"
$bytes = [System.IO.File]::ReadAllBytes($file)
Write-Host "First 3 bytes: $($bytes[0]) $($bytes[1]) $($bytes[2])"
Write-Host "File size: $($bytes.Length)"

# Check for BOM
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "UTF-8 BOM detected!"
} elseif ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    Write-Host "UTF-16 LE BOM detected!"
} elseif ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    Write-Host "UTF-16 BE BOM detected!"
} else {
    Write-Host "No BOM detected"
}
