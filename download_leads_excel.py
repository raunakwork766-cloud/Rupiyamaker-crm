#!/usr/bin/env python3
"""
Leads Excel Export Downloader
Simple script to download all leads as Excel file
"""

import requests
import sys
import os
from datetime import datetime

# API Configuration
API_BASE_URL = "https://localhost:8049"
API_ENDPOINT = f"{API_BASE_URL}/leads/excel-export/export-leads"

# Disable SSL warnings for self-signed certificates
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_token_from_file():
    """Try to read token from a file"""
    token_file = "auth_token.txt"
    if os.path.exists(token_file):
        with open(token_file, 'r') as f:
            return f.read().strip()
    return None

def get_token_from_user():
    """Prompt user for token"""
    print("\n" + "="*70)
    print("LEADS EXCEL EXPORT DOWNLOADER")
    print("="*70)
    print("\nPlease provide your authentication token.")
    print("\nHow to get your token:")
    print("1. Log in to your CRM system")
    print("2. Open browser Developer Tools (F12)")
    print("3. Go to Application tab → Local Storage")
    print("4. Find 'token' or open 'userData' and copy the token value")
    print("\n" + "-"*70)
    
    token = input("\nEnter your JWT token: ").strip()
    
    # Ask if user wants to save token for future use
    save_token = input("\nSave this token for future use? (y/n): ").strip().lower()
    if save_token == 'y':
        with open("auth_token.txt", 'w') as f:
            f.write(token)
        print("✓ Token saved to 'auth_token.txt'")
    
    return token

def download_excel(token):
    """Download Excel file from API"""
    print("\n" + "="*70)
    print("DOWNLOADING EXCEL FILE...")
    print("="*70)
    
    try:
        # Make API request
        print(f"\n📡 Connecting to: {API_ENDPOINT}")
        print("⏳ Please wait, this may take a few minutes for large datasets...\n")
        
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        response = requests.get(
            API_ENDPOINT,
            headers=headers,
            verify=False,  # Disable SSL verification for localhost
            stream=True
        )
        
        # Check response
        if response.status_code == 401:
            print("❌ ERROR: Unauthorized (401)")
            print("   Your token is invalid or has expired.")
            print("   Please get a fresh token and try again.")
            return False
        
        elif response.status_code == 403:
            print("❌ ERROR: Forbidden (403)")
            print("   You don't have permission to access this resource.")
            return False
        
        elif response.status_code == 404:
            print("❌ ERROR: Not Found (404)")
            print("   The export endpoint is not available.")
            print("   Please make sure the backend is running.")
            return False
        
        elif response.status_code == 500:
            print("❌ ERROR: Internal Server Error (500)")
            print("   The server encountered an error.")
            print("   Please check backend logs and try again.")
            return False
        
        elif response.status_code != 200:
            print(f"❌ ERROR: Server returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"leads_export_{timestamp}.xlsx"
        
        # Save file
        print(f"📥 Saving to: {filename}")
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        file_size = os.path.getsize(filename)
        size_mb = file_size / (1024 * 1024)
        
        print("\n" + "="*70)
        print("✅ SUCCESS!")
        print("="*70)
        print(f"\nFile downloaded: {filename}")
        print(f"File size: {size_mb:.2f} MB")
        print(f"\n📊 Your Excel file contains all leads from the CRM.")
        print(f"   Open it in Excel, Google Sheets, or any spreadsheet application.")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to server")
        print("   Please make sure:")
        print("   1. The backend is running on https://localhost:8049")
        print("   2. The backend accepts connections on port 8049")
        return False
    
    except requests.exceptions.Timeout:
        print("\n❌ ERROR: Request timeout")
        print("   The server took too long to respond.")
        print("   Try again or check if the dataset is too large.")
        return False
    
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print(f"   An unexpected error occurred.")
        return False

def main():
    """Main function"""
    print("\n" + "="*70)
    print("   LEADS EXCEL EXPORT DOWNLOADER")
    print("="*70)
    
    # Try to get token from file first
    token = get_token_from_file()
    
    if not token:
        # If no token file, prompt user
        token = get_token_from_user()
    else:
        print(f"\n✓ Found saved token from 'auth_token.txt'")
        use_saved = input("Use this token? (y/n): ").strip().lower()
        if use_saved != 'y':
            token = get_token_from_user()
    
    if not token:
        print("\n❌ ERROR: No token provided. Exiting.")
        sys.exit(1)
    
    # Download Excel file
    success = download_excel(token)
    
    if success:
        print("\n" + "="*70)
        sys.exit(0)
    else:
        print("\n" + "="*70)
        print("\n❌ Download failed. Please try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()