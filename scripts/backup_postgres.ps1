# PostgreSQL Automated Backup Script for DCMMS Local Government Server
# Suitable for Windows Task Scheduler or Cron Execution

param (
    [string]$DbUser = "db_user",
    [string]$DbName = "dmms_db",
    [string]$BackupDir = "C:\Backups\PostgreSQL",
    [int]$RetentionDays = 30
)

# Ensure backup directory exists
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path -Path $BackupDir -ChildPath ("dmms_backup_" + $Timestamp + ".dump")
$LogFile = Join-Path -Path $BackupDir -ChildPath "backup_log.txt"

Write-Output "[$(Get-Date)] Starting PostgreSQL database backup for database '$DbName'..." | Out-File -FilePath $LogFile -Append

try {
    # Execute pg_dump custom format backup
    & pg_dump -U $DbUser -d $DbName -F c -b -v -f $BackupFile 2>> $LogFile

    if ($LASTEXITCODE -eq 0) {
        Write-Output "[$(Get-Date)] Backup completed successfully: $BackupFile" | Out-File -FilePath $LogFile -Append
    } else {
        Write-Output "[$(Get-Date)] Backup failed with exit code $LASTEXITCODE" | Out-File -FilePath $LogFile -Append
    }

    # Delete backups older than RetentionDays
    Get-ChildItem -Path $BackupDir -Filter "*.dump" | Where-CreationTime -lt (Get-Date).AddDays(-$RetentionDays) | Remove-Item -Force
    Write-Output "[$(Get-Date)] Cleaned up backup files older than $RetentionDays days." | Out-File -FilePath $LogFile -Append
}
catch {
    Write-Output "[$(Get-Date)] Exception occurred during backup: $_" | Out-File -FilePath $LogFile -Append
}
