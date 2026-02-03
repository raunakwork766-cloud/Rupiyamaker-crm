#!/bin/bash

# Backup Management Script
# This script manages backups for production and staging

set -e

echo "========================================="
echo "💾 BACKUP MANAGEMENT SCRIPT"
echo "========================================="

# Configuration
BACKUP_DIR="/var/www/rupiyame-backups"
PRODUCTION_DIR="/var/www/rupiyame-production"
STAGING_DIR="/var/www/rupiyame-staging"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo."
    echo "   Example: sudo ./manage-backups.sh"
    exit 1
fi

# Function to list backups
list_backups() {
    echo ""
    echo "📋 Available Backups:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "❌ No backup directory found"
        return
    fi
    
    # Count backups
    local count=0
    
    for backup in $(ls -t "$BACKUP_DIR" 2>/dev/null); do
        backup_path="$BACKUP_DIR/$backup"
        if [ -d "$backup_path" ]; then
            count=$((count + 1))
            size=$(du -sh "$backup_path" | cut -f1)
            modified=$(stat -c %y "$backup_path" | cut -d'.' -f1)
            
            echo "  📦 $backup"
            echo "     Size: $size"
            echo "     Modified: $modified"
            
            # Determine type
            if [[ $backup == *"production_backup"* ]]; then
                echo "     Type: Production"
            elif [[ $backup == *"staging_backup"* ]]; then
                echo "     Type: Staging"
            elif [[ $backup == *"emergency"* ]]; then
                echo "     Type: Emergency (Do not delete)"
            else
                echo "     Type: Unknown"
            fi
            
            echo ""
        fi
    done
    
    if [ $count -eq 0 ]; then
        echo "❌ No backups found"
    else
        echo "Total backups: $count"
    fi
}

# Function to create backup
create_backup() {
    local source_dir="$1"
    local backup_type="$2"
    
    if [ ! -d "$source_dir" ]; then
        echo "❌ Source directory not found: $source_dir"
        return 1
    fi
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="${backup_type}_backup_$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    echo ""
    echo "💾 Creating $backup_type backup..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_PATH"
    
    rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' \
        --exclude='.git' --exclude='logs' \
        "$source_dir/" "$BACKUP_PATH/"
    
    SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
    echo "✅ Backup created: $BACKUP_PATH"
    echo "   Size: $SIZE"
}

# Function to delete backup
delete_backup() {
    local backup_name="$1"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        echo "❌ Backup not found: $backup_name"
        return 1
    fi
    
    # Prevent deletion of emergency backups
    if [[ $backup_name == *"emergency"* ]]; then
        echo "❌ Cannot delete emergency backups!"
        return 1
    fi
    
    echo ""
    echo "⚠️  WARNING: You are about to delete backup: $backup_name"
    read -p "Are you sure? (type 'yes' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        echo "❌ Deletion cancelled"
        return 0
    fi
    
    rm -rf "$backup_path"
    echo "✅ Backup deleted: $backup_name"
}

# Function to clean old backups
clean_old_backups() {
    local backup_type="$1"
    local keep_count="$2"
    
    if [ -z "$keep_count" ]; then
        keep_count=5
    fi
    
    echo ""
    echo "🧹 Cleaning old $backup_type backups (keeping last $keep_count)..."
    
    # List and count backups of specific type
    local backups=()
    for backup in $(ls -t "$BACKUP_DIR" 2>/dev/null | grep "${backup_type}_backup_"); do
        backups+=("$backup")
    done
    
    if [ ${#backups[@]} -le $keep_count ]; then
        echo "✅ No backups to clean (have ${#backups[@]}, keeping $keep_count)"
        return 0
    fi
    
    # Delete old backups
    local delete_count=$((${#backups[@]} - keep_count))
    for ((i=$keep_count; i<${#backups[@]}; i++)); do
        local backup="${backups[$i]}"
        local backup_path="$BACKUP_DIR/$backup"
        
        # Skip emergency backups
        if [[ $backup == *"emergency"* ]]; then
            continue
        fi
        
        rm -rf "$backup_path"
        echo "   Deleted: $backup"
    done
    
    echo "✅ Cleaned $delete_count old backups"
}

# Main menu
case "$1" in
    list)
        list_backups
        ;;
    create-production)
        create_backup "$PRODUCTION_DIR" "production"
        ;;
    create-staging)
        create_backup "$STAGING_DIR" "staging"
        ;;
    delete)
        if [ -z "$2" ]; then
            echo "❌ Usage: $0 delete <backup_name>"
            exit 1
        fi
        delete_backup "$2"
        ;;
    clean-production)
        clean_old_backups "production" "${2:-5}"
        ;;
    clean-staging)
        clean_old_backups "staging" "${2:-5}"
        ;;
    clean-all)
        clean_old_backups "production" "${2:-5}"
        clean_old_backups "staging" "${2:-5}"
        ;;
    *)
        echo ""
        echo "Usage: $0 <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  list                          List all backups"
        echo "  create-production             Create production backup"
        echo "  create-staging                Create staging backup"
        echo "  delete <backup_name>          Delete specific backup"
        echo "  clean-production [count]      Keep N latest production backups (default: 5)"
        echo "  clean-staging [count]         Keep N latest staging backups (default: 5)"
        echo "  clean-all [count]            Clean both production and staging backups"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 create-production"
        echo "  $0 delete production_backup_20260103_143000"
        echo "  $0 clean-production 3"
        echo "  $0 clean-all 5"
        exit 1
        ;;
esac

echo ""
echo "========================================="
