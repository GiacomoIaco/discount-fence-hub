$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $excel.Workbooks.Open('C:\Users\giaco\discount-fence-hub\docs\QBO exports\2025.12.15 Discount Fence Enterprises USA LLC_Customer Contact List.xlsx')
$sheet = $workbook.Sheets.Item(1)
$usedRange = $sheet.UsedRange

# Search terms - the 12 unmatched builders
$searches = @(
    "Ash Creek",
    "Bryson",
    "Catalyst",
    "Golden Oak",
    "Heyl",
    "Homebound",
    "Lux Endeavors",
    "Nexstep",
    "Thurman",
    "Ricara",
    "Silverton",
    "Two Ten",
    "Hillwood"
)

Write-Host "=== SEARCHING FOR UNMATCHED BUILDERS ==="
Write-Host ""

foreach ($search in $searches) {
    Write-Host "--- Searching for: $search ---"
    $found = $false
    for ($row = 5; $row -le $usedRange.Rows.Count; $row++) {
        $customerName = $sheet.Cells.Item($row, 1).Text
        if ($customerName -like "*$search*") {
            Write-Host "  Row $row : $customerName"
            $found = $true
        }
    }
    if (-not $found) {
        Write-Host "  NOT FOUND"
    }
    Write-Host ""
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
