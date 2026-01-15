$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $excel.Workbooks.Open('C:\Users\giaco\discount-fence-hub\docs\QBO exports\2025.12.15 Discount Fence Enterprises USA LLC_Customer Contact List.xlsx')
$sheet = $workbook.Sheets.Item(1)
$usedRange = $sheet.UsedRange

# Our 57 builders to find
$builders = @(
    "512 Home Remodel",
    "Alta Vista Builders",
    "Arbogast Homes",
    "Ash Creek Homes, Inc",
    "Ashton Oak Construction",
    "Ashton Woods Homes",
    "Bryson MPC Holdings",
    "C2 Custom Building",
    "CastleRock Communities",
    "Catalyst Construction",
    "Chesmar Homes",
    "Clark Wilson Builders",
    "D.R. Horton",
    "David Weekely Homes",
    "Drees Custom Homes",
    "Driftwood Golf Club Inc",
    "Empire Communities",
    "Eppright Homes",
    "GFO Homes",
    "Giddens Custom Homes",
    "Golden Oak Build",
    "Grandview Custom Homes",
    "Group Three Builders",
    "Heyl Homes",
    "Highland Homes",
    "Homebound Technolgies",
    "Landsea Homes",
    "Lennar Homes",
    "LGI Homes",
    "Lux Endeavors",
    "M/I Homes",
    "Masonwood Development",
    "MHI Homes",
    "Milestone Community Builders",
    "Millennium Pools",
    "Modern Homestead",
    "New Home Co.",
    "Nexstep Homes, LLC dba Thurman Homes",
    "Perry Homes",
    "Pulte Homes",
    "Rausch Coleman",
    "Ricara Constructions LLC",
    "Richmond American",
    "Robins Construction",
    "Scott Felder Homes",
    "Sendero Homes",
    "Silverado Signature Homes",
    "Silverton Custom Homes",
    "Southerly Homes",
    "Starlight Homes",
    "Thurman Homes",
    "Tri Pointe Homes",
    "Two Ten Communities",
    "Westin Homes",
    "Williams Homes",
    "Zach Savage Homes",
    "Hillwood Communities"
)

Write-Host "=== BUILDER MATCHES FROM QBO EXPORT ==="
Write-Host ""

$results = @()
foreach ($builder in $builders) {
    $found = $false
    for ($row = 5; $row -le $usedRange.Rows.Count; $row++) {
        $customerName = $sheet.Cells.Item($row, 1).Text
        # Exact match only (not sub-customers)
        if ($customerName -eq $builder) {
            $phone = $sheet.Cells.Item($row, 2).Text
            $email = $sheet.Cells.Item($row, 3).Text
            Write-Host "FOUND: $builder (Row $row)"
            Write-Host "  Phone: $phone"
            Write-Host "  Email: $email"
            $found = $true
            $results += [PSCustomObject]@{
                Name = $builder
                Row = $row
                Found = $true
            }
            break
        }
    }
    if (-not $found) {
        Write-Host "NOT FOUND: $builder"
        $results += [PSCustomObject]@{
            Name = $builder
            Row = 0
            Found = $false
        }
    }
}

Write-Host ""
Write-Host "=== SUMMARY ==="
$foundCount = ($results | Where-Object { $_.Found }).Count
$notFoundCount = ($results | Where-Object { -not $_.Found }).Count
Write-Host "Found: $foundCount"
Write-Host "Not Found: $notFoundCount"

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
