$file = "C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js"
$lines = [System.IO.File]::ReadAllLines($file)

# Count opening and closing braces cumulatively
$braceCount = 0
$parenCount = 0
$bracketCount = 0
$inTemplate = $false

for ($idx = 0; $idx -lt $lines.Length; $idx++) {
    $line = $lines[$idx]
    $lineNum = $idx + 1
    
    # Count braces (simplified - doesn't handle strings perfectly but good enough)
    foreach ($ch in $line.ToCharArray()) {
        if ($ch -eq '{') { $braceCount++ }
        if ($ch -eq '}') { $braceCount-- }
    }
    
    # Report if brace count goes negative
    if ($braceCount -lt 0) {
        Write-Output "BRACE NEGATIVE at line $lineNum (count=$braceCount): $($line.Substring(0, [Math]::Min(120, $line.Length)))"
    }
}

Write-Output "Final brace count: $braceCount"
Write-Output "Total lines: $($lines.Length)"
