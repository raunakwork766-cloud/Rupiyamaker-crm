#!/usr/bin/env python3
"""
One-time fix: ensure all users.employee_id values use RM### format.
Also updates employee_id references in other collections when they match the old value.
Does NOT change usernames or passwords.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pymongo import MongoClient
from app.config import Config
from app.database.Users import UsersDB

DB_NAME = os.getenv("MONGO_DB_NAME", "crm_database")

# Collections/fields that may store HR employee_id strings (not Mongo _id)
REFERENCE_FIELDS = [
    ("leaves", "employee_id"),
    ("leave_balance", "employee_id"),
    ("attendance", "employee_id"),
    ("attendance_records", "employee_id"),
    ("warnings", "employee_id"),
    ("dialer_reports", "employee_id"),
    ("employee_remarks", "employee_id"),
    ("salary_allocations", "employee_id"),
    ("salary_deductions", "employee_id"),
]


def main():
    client = MongoClient(Config.MONGO_URI)
    db = client[DB_NAME]
    users = db["users"]

    employees = list(users.find(
        {"employee_id": {"$exists": True, "$ne": None, "$ne": ""}},
        {"employee_id": 1, "first_name": 1, "last_name": 1, "username": 1},
    ))

    print(f"Scanning {len(employees)} users with employee_id...")
    mapping = {}
    skipped = 0

    for emp in employees:
        old_id = str(emp.get("employee_id", "")).strip()
        if not old_id:
            continue
        new_id = UsersDB.normalize_employee_id(old_id)
        if new_id == old_id:
            skipped += 1
            continue
        mapping[old_id] = new_id
        print(f"  {old_id} -> {new_id} | {emp.get('first_name', '')} {emp.get('last_name', '')}".strip())

    if not mapping:
        print("Nothing to update — all employee IDs already have RM prefix.")
        client.close()
        return

    print(f"\nUpdating {len(mapping)} user records...")
    user_updates = 0
    for old_id, new_id in mapping.items():
        result = users.update_many({"employee_id": old_id}, {"$set": {"employee_id": new_id}})
        user_updates += result.modified_count

    ref_updates = 0
    for collection_name, field in REFERENCE_FIELDS:
        if collection_name not in db.list_collection_names():
            continue
        coll = db[collection_name]
        for old_id, new_id in mapping.items():
            result = coll.update_many({field: old_id}, {"$set": {field: new_id}})
            ref_updates += result.modified_count

    print(f"Done: {user_updates} user docs updated, {ref_updates} related reference docs updated, {skipped} already OK.")
    client.close()


if __name__ == "__main__":
    main()
