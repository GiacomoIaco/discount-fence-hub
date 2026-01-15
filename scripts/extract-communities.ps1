$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $excel.Workbooks.Open('C:\Users\giaco\discount-fence-hub\docs\QBO exports\2025.12.15 Discount Fence Enterprises USA LLC_Customer Contact List.xlsx')
$sheet = $workbook.Sheets.Item(1)
$usedRange = $sheet.UsedRange

Write-Host "Loading all customers into memory..."
$allCustomers = @()
$totalRows = $usedRange.Rows.Count
for ($row = 5; $row -le $totalRows; $row++) {
    $customerName = $sheet.Cells.Item($row, 1).Text
    if ($customerName) {
        $allCustomers += [PSCustomObject]@{
            Row = $row
            DisplayName = $customerName
            Phone = $sheet.Cells.Item($row, 2).Text
            Email = $sheet.Cells.Item($row, 3).Text
        }
    }
}
Write-Host "Loaded $($allCustomers.Count) customers"
Write-Host ""

# Our 57 builders
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

Write-Host "=== COMMUNITIES PER BUILDER ==="
Write-Host ""

$totalCommunities = 0
foreach ($builder in $builders) {
    $prefix = "${builder}:"
    $communities = $allCustomers | Where-Object { $_.DisplayName.StartsWith($prefix) }

    if ($communities.Count -gt 0) {
        Write-Host "$builder : $($communities.Count) communities"
        foreach ($comm in $communities) {
            $communityName = $comm.DisplayName.Substring($prefix.Length).Trim()
            Write-Host "  - $communityName"
        }
        $totalCommunities += $communities.Count
    }
}

Write-Host ""
Write-Host "=== TOTAL COMMUNITIES: $totalCommunities ==="

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
