import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin")
    db = client.crm_database 
    
    collections = await db.list_collection_names()
    print("Collections in crm_database:", collections)
    
    if "dialer_upload_history" in collections:
        count = await db.dialer_upload_history.count_documents({})
        print(f"Deleting {count} old dialer records...")
        await db.dialer_upload_history.delete_many({})
        print("Cleared.")
    else:
        print("dialer_upload_history not found in crm_database.")

asyncio.run(main())
