$srcDir = "d:\annie\BeadsInventory\src"
$outFile = "d:\annie\BeadsInventory\index.html"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "Building index.html from src/..."

$files = Get-ChildItem -Path $srcDir -Filter "*.html" | Sort-Object Name
$fullContent = ""

foreach ($file in $files) {
    Write-Host "Appending $($file.Name)..."
    # Force read as UTF-8
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $fullContent += $content + "`n"
}

# Write as UTF-8 No BOM
[System.IO.File]::WriteAllText($outFile, $fullContent, $utf8NoBom)

Write-Host "Done! index.html rebuilt."
