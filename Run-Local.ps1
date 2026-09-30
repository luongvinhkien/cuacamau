$ErrorActionPreference = 'Stop'

function Read-SecretText([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
    }
}

$dbServer = [string](Read-Host 'MySQL host (Aiven: Overview > Connection information)')
$mysqlPort = [string](Read-Host 'MySQL port')
$database = [string](Read-Host 'Database name')
$dbUser = [string](Read-Host 'Database username')
$dbPassword = Read-SecretText 'Database password (hidden)'
$caPath = Read-Host 'Full path to downloaded Aiven CA certificate (.pem)'
$adminUser = Read-Host 'Admin login name [admin]'
if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = 'admin' }
$resetExistingAdmin = (Read-Host 'Reset existing Admin password? Type YES to confirm') -ceq 'YES'
$adminPassword = Read-SecretText $(if ($resetExistingAdmin) { 'New Admin password (hidden)' } else { 'Initial Admin password, at least 10 characters (hidden; leave blank if Admin already exists)' })
if ($resetExistingAdmin -and $adminPassword.Length -lt 6) { throw 'Reset password must contain at least 6 characters.' }
if (-not $resetExistingAdmin -and $adminPassword.Length -gt 0 -and $adminPassword.Length -lt 10) { throw 'Initial Admin password must contain at least 10 characters.' }
if (-not (Test-Path -LiteralPath $caPath -PathType Leaf)) { throw "CA certificate not found: $caPath" }

$builder = [System.Data.Common.DbConnectionStringBuilder]::new()
$builder['Server'] = [string]$dbServer
$builder['Port'] = [string]$mysqlPort
$builder['Database'] = [string]$database
$builder['User ID'] = [string]$dbUser
$builder['Password'] = [string]$dbPassword
$builder['SslMode'] = [string]'VerifyCA'
$builder['SslCa'] = [string]$caPath
$connection = $builder.ConnectionString

Push-Location $PSScriptRoot
try {
    $env:LIVEORDER_MYSQL = $connection
    $env:LIVEORDER_ADMIN_USER = $adminUser
    $env:LIVEORDER_ADMIN_PASSWORD = $adminPassword
    $env:LIVEORDER_RESET_ADMIN_PASSWORD = [string]$resetExistingAdmin
    dotnet run
}
finally {
    Remove-Item Env:LIVEORDER_MYSQL -ErrorAction SilentlyContinue
    Remove-Item Env:LIVEORDER_ADMIN_USER -ErrorAction SilentlyContinue
    Remove-Item Env:LIVEORDER_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:LIVEORDER_RESET_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
    $connection = $dbPassword = $adminPassword = $null
}
