#!/usr/bin/env python3
"""
Diagnostic script to check why inactive employees can still login.
This script examines the actual database state and helps identify the issue.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database.Users import UsersDB
from app.database import get_database_instances

async def diagnose_employee_login():
    """Diagnose why inactive employee can login"""
    
    print("=" * 80)
    print("EMPLOYEE LOGIN DIAGNOSTIC TOOL")
    print("=" * 80)
    print()
    
    # Initialize database
    try:
        db_instances = get_database_instances()
        users_db = db_instances["users"]
        print("✅ Connected to database")
        print()
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    # Get username to check
    username = input("Enter the username of the employee that can login (or press Enter for all employees): ").strip()
    
    if username:
        # Check specific user
        print(f"\n{'='*80}")
        print(f"CHECKING USER: {username}")
        print(f"{'='*80}\n")
        
        user = await users_db.get_user_by_username(username)
        
        if not user:
            print(f"❌ User '{username}' not found in database")
            return
        
        print_user_details(user)
        check_login_eligibility(user)
        
    else:
        # Show all employees with their status
        print(f"\n{'='*80}")
        print("LISTING ALL EMPLOYEES")
        print(f"{'='*80}\n")
        
        employees = await users_db.get_employees()
        
        if not employees:
            print("❌ No employees found in database")
            return
        
        print(f"Found {len(employees)} employees\n")
        print("-" * 80)
        
        for emp in employees:
            print_user_summary(emp)
            print("-" * 80)
            print()
        
        # Summary
        active_count = sum(1 for e in employees if e.get("employee_status") == "active")
        inactive_count = len(employees) - active_count
        
        print(f"\n{'='*80}")
        print("SUMMARY")
        print(f"{'='*80}")
        print(f"Total Employees: {len(employees)}")
        print(f"Active Employees: {active_count}")
        print(f"Inactive Employees: {inactive_count}")
        print()
        
        # Check potential issues
        issues = []
        
        for emp in employees:
            # Check 1: is_employee flag
            if not emp.get("is_employee", False):
                issues.append(f"⚠️  User '{emp.get('username', 'unknown')}' has is_employee=False but is in employee list")
            
            # Check 2: Inactive but can login
            if emp.get("employee_status") != "active" and emp.get("login_enabled", True):
                issues.append(f"⚠️  User '{emp.get('username', 'unknown')}' is inactive but login_enabled=True")
            
            # Check 3: Missing employee_status field
            if "employee_status" not in emp:
                issues.append(f"⚠️  User '{emp.get('username', 'unknown')}' is missing employee_status field")
            
            # Check 4: is_active vs employee_status mismatch
            if emp.get("is_active", True) != (emp.get("employee_status") == "active"):
                issues.append(f"⚠️  User '{emp.get('username', 'unknown')}' has is_active={emp.get('is_active')} but employee_status={emp.get('employee_status')}")
        
        if issues:
            print(f"\n{'='*80}")
            print("POTENTIAL ISSUES FOUND:")
            print(f"{'='*80}")
            for issue in issues:
                print(issue)
        else:
            print("\n✅ No obvious issues found with employee data")

def print_user_details(user):
    """Print detailed user information"""
    print("User Details:")
    print("-" * 80)
    print(f"ID:           {str(user.get('_id'))}")
    print(f"Username:     {user.get('username', 'N/A')}")
    print(f"Email:        {user.get('email', 'N/A')}")
    print(f"Name:         {user.get('first_name', '')} {user.get('last_name', '')}")
    print()
    print("Status Fields:")
    print("-" * 80)
    print(f"is_employee:        {user.get('is_employee', False)}")
    print(f"is_active:          {user.get('is_active', True)}")
    print(f"employee_status:    {user.get('employee_status', 'N/A')}")
    print(f"login_enabled:      {user.get('login_enabled', True)}")
    print()
    print("Other Fields:")
    print("-" * 80)
    print(f"role_id:           {user.get('role_id', 'N/A')}")
    print(f"department_id:      {user.get('department_id', 'N/A')}")
    print(f"designation:        {user.get('designation', 'N/A')}")
    print(f"employee_id:        {user.get('employee_id', 'N/A')}")
    print()

def check_login_eligibility(user):
    """Check if user should be able to login"""
    print("Login Eligibility Check:")
    print("-" * 80)
    
    can_login = True
    reasons = []
    
    # Check 1: is_employee flag
    is_employee = user.get("is_employee", False)
    print(f"1. Is this an employee? {is_employee}")
    
    if not is_employee:
        print("   → Not an employee, skipping employee status check")
    else:
        # Check 2: employee_status
        employee_status = user.get("employee_status", "active")
        print(f"2. Employee status: {employee_status}")
        
        if employee_status != "active":
            print("   ❌ BLOCKED: Employee status is not 'active'")
            can_login = False
            reasons.append("Employee status is inactive")
        else:
            print("   ✅ PASS: Employee status is 'active'")
    
    # Check 3: is_active
    is_active = user.get("is_active", True)
    print(f"3. User is_active: {is_active}")
    
    if not is_active:
        print("   ❌ BLOCKED: User account is not active")
        can_login = False
        reasons.append("User account is inactive")
    else:
        print("   ✅ PASS: User account is active")
    
    # Check 4: login_enabled
    login_enabled = user.get("login_enabled", True)
    print(f"4. Login enabled: {login_enabled}")
    
    if not login_enabled:
        print("   ❌ BLOCKED: Login access is disabled")
        can_login = False
        reasons.append("Login access is disabled")
    else:
        print("   ✅ PASS: Login is enabled")
    
    print()
    print("FINAL RESULT:")
    print("-" * 80)
    
    if can_login:
        print("✅ User SHOULD be able to login")
    else:
        print("❌ User SHOULD NOT be able to login")
        print()
        print("Blocking reason(s):")
        for reason in reasons:
            print(f"  - {reason}")
    
    print()

def print_user_summary(user):
    """Print summary of user"""
    username = user.get('username', 'unknown')
    is_employee = user.get('is_employee', False)
    is_active = user.get('is_active', True)
    employee_status = user.get('employee_status', 'N/A')
    login_enabled = user.get('login_enabled', True)
    
    # Determine overall status
    if not is_employee:
        overall = "NOT EMPLOYEE"
    elif employee_status != "active":
        overall = "INACTIVE EMPLOYEE"
    elif not is_active:
        overall = "INACTIVE USER"
    elif not login_enabled:
        overall = "LOGIN DISABLED"
    else:
        overall = "ACTIVE EMPLOYEE"
    
    print(f"Username: {username:<20} | Employee Status: {employee_status:<10} | Login Enabled: {login_enabled:<5} | Overall: {overall}")

if __name__ == "__main__":
    asyncio.run(diagnose_employee_login())