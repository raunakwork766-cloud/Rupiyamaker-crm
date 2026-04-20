"""
Migration script: Remove 'RM' prefix from employee usernames.

For employees whose username starts with 'rm' (case-insensitive),
update the username to: {employee_id}{first_name_lowercase_no_spaces}

Employees with custom usernames (e.g., 'raunak', 'aryan') are left unchanged.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"
DB_NAME = "crm_database"


async def migrate():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db.users

    # Fetch all employees
    cursor = collection.find({"is_employee": True}, {
        "_id": 1,
        "employee_id": 1,
        "username": 1,
        "first_name": 1,
    })

    to_update = []
    skipped = []

    async for emp in cursor:
        username = emp.get("username") or ""
        employee_id = emp.get("employee_id") or ""
        first_name = emp.get("first_name") or ""

        # Only update usernames that start with 'rm' (case-insensitive)
        if username.lower().startswith("rm"):
            # Build new username: employee_id + first_name (lowercase, spaces removed)
            clean_first_name = first_name.lower().replace(" ", "")
            new_username = f"{employee_id}{clean_first_name}"
            to_update.append({
                "_id": emp["_id"],
                "old_username": username,
                "new_username": new_username,
                "employee_id": employee_id,
                "first_name": first_name,
            })
        else:
            skipped.append({
                "employee_id": employee_id,
                "username": username,
                "first_name": first_name,
            })

    print(f"\n{'='*60}")
    print(f"Employees to UPDATE ({len(to_update)}):")
    print(f"{'='*60}")
    for item in to_update:
        print(f"  [{item['employee_id']}] {item['old_username']}  ->  {item['new_username']}")

    print(f"\n{'='*60}")
    print(f"Employees SKIPPED (no RM prefix) ({len(skipped)}):")
    print(f"{'='*60}")
    for item in skipped:
        print(f"  [{item['employee_id']}] {item['username']}  (first_name: {item['first_name']})")

    if not to_update:
        print("\nNo employees need updating.")
        return

    confirm = input(f"\nProceed with updating {len(to_update)} username(s)? [yes/no]: ").strip().lower()
    if confirm != "yes":
        print("Aborted. No changes made.")
        return

    # Perform updates
    success = 0
    errors = 0
    for item in to_update:
        try:
            result = await collection.update_one(
                {"_id": item["_id"]},
                {"$set": {"username": item["new_username"]}}
            )
            if result.modified_count == 1:
                print(f"  ✓ Updated [{item['employee_id']}]: {item['old_username']} -> {item['new_username']}")
                success += 1
            else:
                print(f"  ⚠ No change for [{item['employee_id']}]: {item['old_username']}")
                errors += 1
        except Exception as e:
            print(f"  ✗ Error updating [{item['employee_id']}] {item['old_username']}: {e}")
            errors += 1

    print(f"\n{'='*60}")
    print(f"Done. Updated: {success}, Errors/unchanged: {errors}")
    print(f"{'='*60}\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
