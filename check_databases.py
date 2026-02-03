#!/usr/bin/env python3
from pymongo import MongoClient

client = MongoClient('mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin')

print('All databases:')
for db_name in client.list_database_names():
    print(f'  - {db_name}')
    
print('\nCollections in each database:')
for db_name in client.list_database_names():
    if db_name not in ['admin', 'local', 'config']:
        db = client[db_name]
        collections = db.list_collection_names()
        print(f'\n{db_name}:')
        for coll in collections:
            count = db[coll].count_documents({})
            print(f'  - {coll}: {count} documents')