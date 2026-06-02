$file = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)

# Search for lines with potential encoding issues
$found = 0
for ($idx = 0; $idx -lt $lines.Length; $idx++) {
    $line = $lines[$idx]
    # Check for common encoding artifacts
    if ($line -match '\xC3[\x80-\xBF]' -and $line -notmatch '`' -and $line -notmatch "'") {
        # Skip lines inside template literals (they may have Spanish chars legitimately)
    }
    
    # Look for truly broken patterns: unclosed string literals, stray backticks 
    $singleQuotes = ($line.ToCharArray() | Where-Object { $_ -eq "'" }).Count
    $doubleQuotes = ($line.ToCharArray() | Where-Object { $_ -eq '"' }).Count
    $backticks = ($line.ToCharArray() | Where-Object { $_ -eq '`' }).Count
    
    # A line starting with unescaped content that isn't a comment or template
    # Just look for specific broken patterns
    if ($line -match "getElementById\('[^']*$" -and $line -notmatch "getElementById\('[^']*'\)") {
        $lineNum = $idx + 1
        $short = $line.Substring(0, [Math]::Min(120, $line.Length))
        Write-Host "BROKEN getElementById at line ${lineNum}: $short"
        $found++
    }
}

if ($found -eq 0) {
    Write-Host "No broken getElementById found"
}

# Also check app.js for the error line ref
$appFile = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\app.js"
$appLines = [System.IO.File]::ReadAllLines($appFile, [System.Text.Encoding]::UTF8)
Write-Host "`napp.js total lines: $($appLines.Length)"
Write-Host "app.js line 445: $($appLines[444])"
