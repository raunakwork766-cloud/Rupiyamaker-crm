"""
Migration Script: Update Employee IDs and Usernames
====================================================
1. employee_id: "001" → "RM001" (add RM prefix to all)
2. username: "001raunak" → "raunak001" (firstName + numericPart)
3. Does NOT change passwords
4. Prints summary of all active employees with new credentials
"""

from pymongo import MongoClient
import re

MONGO_URI = 'mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin'
DB_NAME = 'crm_database'

def run_migration():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users = db['users']

    all_employees = list(users.find(
        {'employee_id': {'$exists': True, '$ne': None}},
        {'employee_id': 1, 'username': 1, 'first_name': 1, 'last_name': 1, 'is_active': 1, 'phone': 1}
    ))

    print(f"Total employees found: {len(all_employees)}")
    print("=" * 80)

    updated = 0
    skipped = 0
    errors = []
    active_list = []

    for emp in all_employees:
        emp_id = emp.get('employee_id', '')
        old_username = emp.get('username', '')
        first_name = emp.get('first_name', '')
        is_active = emp.get('is_active', True)
        mongo_id = emp['_id']

        # Skip if already has RM prefix
        if str(emp_id).startswith('RM'):
            print(f"  SKIP (already RM): {emp_id} | {old_username}")
            skipped += 1
            # Still generate the correct username for the list
            numeric_part = str(emp_id)[2:]  # Remove "RM"
            new_username = f"{first_name.lower().replace(' ', '')}" if first_name else old_username
            # Clean: only keep a-z
            new_username = re.sub(r'[^a-z]', '', first_name.lower()) + numeric_part if first_name else old_username
            if is_active:
                active_list.append({
                    'employee_id': emp_id,
                    'name': f"{first_name} {emp.get('last_name', '')}".strip(),
                    'username': old_username,
                    'phone': emp.get('phone', '')
                })
            continue

        # Generate new employee_id with RM prefix
        new_emp_id = f"RM{emp_id}"

        # Generate new username: firstName (lowercase, only a-z) + numeric part
        if first_name:
            clean_name = re.sub(r'[^a-z]', '', first_name.lower())
            numeric_part = emp_id  # e.g., "001"
            new_username = f"{clean_name}{numeric_part}"
        else:
            new_username = old_username  # Keep old if no first_name

        print(f"  UPDATE: emp_id {emp_id} → {new_emp_id} | username {old_username} → {new_username}")

        try:
            result = users.update_one(
                {'_id': mongo_id},
                {'$set': {
                    'employee_id': new_emp_id,
                    'username': new_username
                }}
            )
            if result.modified_count > 0:
                updated += 1
            else:
                print(f"    WARNING: No modification for {mongo_id}")
        except Exception as e:
            error_msg = f"ERROR updating {mongo_id} ({old_username}): {e}"
            print(f"    {error_msg}")
            errors.append(error_msg)

        if is_active:
            active_list.append({
                'employee_id': new_emp_id,
                'name': f"{first_name} {emp.get('last_name', '')}".strip(),
                'username': new_username,
                'phone': emp.get('phone', '')
            })

    print("\n" + "=" * 80)
    print(f"MIGRATION COMPLETE: {updated} updated, {skipped} skipped, {len(errors)} errors")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f"  - {e}")

    # Sort active list by employee_id
    active_list.sort(key=lambda x: x['employee_id'])

    print("\n" + "=" * 80)
    print(f"ACTIVE EMPLOYEES ({len(active_list)}) — New Login Credentials")
    print("=" * 80)
    print(f"{'Emp ID':<10} {'Name':<25} {'Username (Login)':<25} {'Phone':<15}")
    print("-" * 75)
    for emp in active_list:
        print(f"{emp['employee_id']:<10} {emp['name']:<25} {emp['username']:<25} {emp['phone']:<15}")

    print("\n" + "=" * 80)
    print("NOTE: Passwords remain UNCHANGED. Only employee_id and username updated.")
    print("Share new usernames with employees for login.")

    client.close()


if __name__ == '__main__':
    run_migration()
