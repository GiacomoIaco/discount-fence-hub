$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $excel.Workbooks.Open('C:\Users\giaco\discount-fence-hub\docs\QBO exports\2025.12.15 Discount Fence Enterprises USA LLC_Customer Contact List.xlsx')
$sheet = $workbook.Sheets.Item(1)
$usedRange = $sheet.UsedRange

# Get headers (row 1)
Write-Host "=== HEADERS ==="
for ($col = 1; $col -le [Math]::Min($usedRange.Columns.Count, 15); $col++) {
    Write-Host "Col $col : $($sheet.Cells.Item(1, $col).Text)"
}

Write-Host ""
Write-Host "=== TOTAL ROWS: $($usedRange.Rows.Count) ==="
Write-Host ""

# Show first 20 rows
Write-Host "=== SAMPLE DATA (first 20 rows) ==="
for ($row = 2; $row -le [Math]::Min($usedRange.Rows.Count, 21); $row++) {
    $line = "Row $row : "
    for ($col = 1; $col -le [Math]::Min($usedRange.Columns.Count, 5); $col++) {
        $line += $sheet.Cells.Item($row, $col).Text + " | "
    }
    Write-Host $line
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
