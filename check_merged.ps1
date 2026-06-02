# Find lines with odd patterns that could cause SyntaxError
$file = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)

Write-Host "Checking for potential syntax errors..."

for ($idx = 0; $idx -lt $lines.Length; $idx++) {
    $line = $lines[$idx]
    $lineNum = $idx + 1
    $trimmed = $line.TrimStart()
    
    # Check for lines that look like two statements merged together
    # Pattern: text inside a string literal suddenly becomes a keyword
    if ($trimmed -match "^[^/].*'[^']*\s+(const|let|var|function|class|import|export)\s+" -and $trimmed -notmatch "//") {
        $short = $line.Substring(0, [Math]::Min(120, $line.Length))
        Write-Host "MERGED at line ${lineNum}: $short"
    }
    
    # Check for lines with unclosed template literals that don't look like they're part of a multi-line template
    if ($trimmed -match '^\s*\$\{' -and $trimmed -notmatch '`') {
        # This could be a stray template expression outside a template literal
        $short = $line.Substring(0, [Math]::Min(120, $line.Length))
        Write-Host "STRAY_TEMPLATE at line ${lineNum}: $short"
    }
}

Write-Host "`nDone checking."
