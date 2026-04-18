"""One-time backfill: copy `email` -> `personal_email` for users where
`personal_email` is missing/empty. The HRMS form previously mis-stored
the user-typed personal email in the `email` field, so we promote those
values to the new dedicated `personal_email` field. The original `email`
field is preserved (it doubles as the login identity).

Run:  python -m scripts.backfill_personal_email   (from backend-dev/)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import Config


async def main():
    client = AsyncIOMotorClient(Config.MONGO_URI)
    db = client[Config.COMPANY_NAME]
    users = db["users"]

    # Candidates: users with non-empty `email` and empty/missing `personal_email`
    query = {
        "email": {"$exists": True, "$nin": [None, ""]},
        "$or": [
            {"personal_email": {"$exists": False}},
            {"personal_email": None},
            {"personal_email": ""},
        ],
    }

    total = await users.count_documents(query)
    print(f"Candidates to backfill: {total}")

    updated = 0
    skipped = 0
    async for u in users.find(query, {"email": 1, "first_name": 1, "last_name": 1, "employee_id": 1}):
        email = (u.get("email") or "").strip()
        if not email:
            skipped += 1
            continue
        result = await users.update_one(
            {"_id": u["_id"]},
            {"$set": {"personal_email": email}},
        )
        if result.modified_count:
            updated += 1
            name = f"{u.get('first_name','')} {u.get('last_name','')}".strip()
            emp_id = u.get("employee_id") or ""
            print(f"  + {emp_id} {name}: personal_email = {email}")

    # Final summary
    pe_count = await users.count_documents({
        "personal_email": {"$exists": True, "$nin": [None, ""]}
    })
    total_users = await users.count_documents({})
    print()
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Users with personal_email now: {pe_count}/{total_users}")


if __name__ == "__main__":
    asyncio.run(main())
