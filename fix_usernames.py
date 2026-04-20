"""
Fix all employee usernames to follow the rule:
  username = employee_id + first_name.lower() (only a-z letters)
  
Example: employee_id="067", first_name="DIKSHA" → username="067diksha"

- Does NOT change passwords
- Handles duplicates by appending last_name if conflict
- Reports all changes
"""
import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"
DB_NAME = "crm_database"

def gen_username(emp_id, first_name):
    """Generate username: employee_id + first_name lowercase letters only"""
    clean_first = re.sub(r'[^a-z]', '', (first_name or '').lower())
    return f"{emp_id}{clean_first}"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    col = db["users"]
    
    # Fetch all employees
    employees = []
    async for emp in col.find({"is_employee": True}):
        employees.append(emp)
    
    print(f"Found {len(employees)} employees total\n")
    
    # Track changes
    changes = []
    no_changes = []
    errors = []
    
    # First pass: compute new usernames and check for conflicts
    username_map = {}  # new_username -> employee_id
    
    for emp in employees:
        emp_id = emp.get("employee_id", "")
        first_name = emp.get("first_name", "")
        last_name = emp.get("last_name", "")
        old_username = emp.get("username", "")
        status = emp.get("employee_status", "active")
        
        if not emp_id or not first_name:
            errors.append(f"  SKIP: {emp.get('_id')} - missing employee_id or first_name (id={emp_id}, name={first_name})")
            continue
        
        new_username = gen_username(emp_id, first_name)
        
        # Handle potential duplicates (shouldn't happen with unique emp_id, but just in case)
        if new_username in username_map:
            # Append last name to disambiguate
            clean_last = re.sub(r'[^a-z]', '', (last_name or '').lower())
            new_username = f"{emp_id}{re.sub(r'[^a-z]', '', first_name.lower())}{clean_last}"
        
        username_map[new_username] = str(emp["_id"])
        
        if old_username == new_username:
            no_changes.append({
                "employee_id": emp_id,
                "name": f"{first_name} {last_name}",
                "username": old_username,
                "status": status,
            })
        else:
            changes.append({
                "_id": emp["_id"],
                "employee_id": emp_id,
                "name": f"{first_name} {last_name}",
                "old_username": old_username,
                "new_username": new_username,
                "status": status,
            })
    
    # Print report
    print("=" * 70)
    print("ALREADY CORRECT (no change needed):")
    print("=" * 70)
    for e in sorted(no_changes, key=lambda x: x["employee_id"]):
        print(f"  ✓ [{e['employee_id']}] {e['name']} → {e['username']} ({e['status']})")
    print(f"\nTotal already correct: {len(no_changes)}\n")
    
    print("=" * 70)
    print("NEEDS FIX:")
    print("=" * 70)
    for c in sorted(changes, key=lambda x: x["employee_id"]):
        print(f"  ✏ [{c['employee_id']}] {c['name']}: \"{c['old_username']}\" → \"{c['new_username']}\" ({c['status']})")
    print(f"\nTotal to fix: {len(changes)}\n")
    
    if errors:
        print("ERRORS/SKIPPED:")
        for e in errors:
            print(e)
        print()
    
    # Apply changes
    if changes:
        print("Applying changes...")
        success = 0
        for c in changes:
            try:
                result = await col.update_one(
                    {"_id": c["_id"]},
                    {"$set": {"username": c["new_username"]}}
                )
                if result.modified_count == 1:
                    success += 1
                    print(f"  ✅ [{c['employee_id']}] {c['name']}: updated to \"{c['new_username']}\"")
                else:
                    print(f"  ⚠ [{c['employee_id']}] {c['name']}: no modification (might already be set)")
            except Exception as ex:
                print(f"  ❌ [{c['employee_id']}] {c['name']}: ERROR - {ex}")
        print(f"\nSuccessfully updated: {success}/{len(changes)}")
    else:
        print("All usernames are already correct! No changes needed.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
