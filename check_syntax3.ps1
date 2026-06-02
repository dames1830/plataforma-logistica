# Quick JS syntax check by looking for common errors
$file = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"
$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Check for unmatched backticks (template literals) outside of strings
# Count backticks
$backtickCount = ($text.ToCharArray() | Where-Object { $_ -eq '``' }).Count
Write-Host "Total backticks: $backtickCount"
if ($backtickCount % 2 -ne 0) {
    Write-Host "WARNING: Odd number of backticks - possible unclosed template literal!"
}

# Check lines for obvious patterns
$lines = $text -split "`r?`n"
Write-Host "Total lines: $($lines.Length)"

# Look for lines containing arrow function syntax broken across definitions
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $ln = $i + 1
    
    # Pattern: a line that has two arrow functions defined on same line (indicating merge)
    if ($line -match '=>\s*\{.*=>\s*\{' -and $line -notmatch '\.map\(' -and $line -notmatch '\.filter\(' -and $line -notmatch '\.find\(' -and $line -notmatch '\.forEach\(' -and $line -notmatch '\.reduce\(' -and $line -notmatch '\.some\(' -and $line -notmatch '\.every\(') {
        $short = $line.Substring(0, [Math]::Min(150, $line.Length))
        Write-Host "DOUBLE_ARROW at L${ln}: $short"
    }
    
    # Find lines with stray semicolons that end a const/let/function declaration improperly
    if ($line -match '^\s*(const|let|var)\s+\w+\s*=.*;\s*(const|let|var|function)\s+') {
        $short = $line.Substring(0, [Math]::Min(150, $line.Length))
        Write-Host "DOUBLE_DECL at L${ln}: $short"
    }
}

# Check for 'smart quotes' that could break parsing
$smartQuoteLines = @()
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '[\u2018\u2019\u201C\u201D]') {
        $smartQuoteLines += ($i + 1)
    }
}
if ($smartQuoteLines.Length -gt 0) {
    Write-Host "SMART QUOTES found at lines: $($smartQuoteLines -join ', ')"
} else {
    Write-Host "No smart quotes found."
}

Write-Host "`nDone."
