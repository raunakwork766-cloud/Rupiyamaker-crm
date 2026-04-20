"""
Generate department-wise active employee list with usernames for WhatsApp sharing.
Hierarchy: Manager → Team Leader → Senior Consultant → Consultant
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"
DB_NAME = "crm_database"

# Designation priority for sorting
DESIGNATION_ORDER = {
    "DIRECTOR OF OPERATIONS": 0,
    "MANAGING DIRECTOR": 1,
    "DIRECTOR OF FINANCE": 2,
    "TEAM MANAGER": 3,
    "MANAGER": 4,
    "TEAM LEADER": 5,
    "SENIOR CONSULTANT": 6,
    "CONSULTANT": 7,
    "JUNIOR CONSULTANT": 8,
    "INTERN": 9,
}

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Get departments
    departments = {}
    async for dept in db["departments"].find():
        departments[str(dept["_id"])] = dept.get("name", "Unknown")
    
    # Get roles
    roles = {}
    async for role in db["roles"].find():
        roles[str(role["_id"])] = role.get("name", "Unknown")
    
    # Get active employees
    employees = []
    async for emp in db["users"].find({"is_employee": True, "employee_status": "active"}):
        employees.append(emp)
    
    # Group by department
    dept_groups = {}
    no_dept = []
    
    for emp in employees:
        dept_id = emp.get("department_id", "")
        dept_name = departments.get(dept_id, "No Department")
        
        entry = {
            "employee_id": emp.get("employee_id", "???"),
            "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "username": emp.get("username", "N/A"),
            "designation": (emp.get("designation", "") or emp.get("position", "") or "No Designation").upper(),
            "role": roles.get(str(emp.get("role_id", "")), "No Role"),
        }
        
        if dept_name == "No Department":
            no_dept.append(entry)
        else:
            if dept_name not in dept_groups:
                dept_groups[dept_name] = []
            dept_groups[dept_name].append(entry)
    
    # Sort employees within each department by designation hierarchy
    def sort_key(e):
        return (DESIGNATION_ORDER.get(e["designation"], 99), e["name"])
    
    # Print WhatsApp-friendly format
    lines = []
    lines.append("📋 *ACTIVE EMPLOYEE LIST — NEW USERNAMES*")
    lines.append(f"📅 Total Active: {len(employees)}")
    lines.append("━" * 40)
    lines.append("")
    
    for dept_name in sorted(dept_groups.keys()):
        emps = sorted(dept_groups[dept_name], key=sort_key)
        lines.append(f"🏢 *{dept_name}* ({len(emps)} members)")
        lines.append("─" * 35)
        
        for e in emps:
            desig = e["designation"].title()
            lines.append(f"  👤 *{e['name']}*")
            lines.append(f"      ID: {e['employee_id']} | {desig}")
            lines.append(f"      🔑 Username: `{e['username']}`")
            lines.append("")
        
        lines.append("")
    
    if no_dept:
        lines.append(f"🏢 *No Department* ({len(no_dept)} members)")
        lines.append("─" * 35)
        for e in sorted(no_dept, key=sort_key):
            desig = e["designation"].title()
            lines.append(f"  👤 *{e['name']}*")
            lines.append(f"      ID: {e['employee_id']} | {desig}")
            lines.append(f"      🔑 Username: `{e['username']}`")
            lines.append("")
    
    lines.append("━" * 40)
    lines.append("⚠️ Password same hai — sirf username change hua hai")
    lines.append("ℹ️ Username = Employee ID + First Name (lowercase)")
    
    output = "\n".join(lines)
    print(output)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
