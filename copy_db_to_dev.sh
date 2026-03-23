#!/bin/bash
# Copy production database to dev database for safe testing

echo "======================================"
echo "Copying Production DB to Dev DB"
echo "======================================"

SOURCE_DB="crm_database"
TARGET_DB="crm_database_dev"
MONGO_URI="mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"

echo "Source: $SOURCE_DB"
echo "Target: $TARGET_DB"
echo ""

# Check if dev database already exists
echo "Checking if dev database exists..."
DB_EXISTS=$(mongosh "$MONGO_URI" --eval "db.getMongo().getDBNames().indexOf('$TARGET_DB')" --quiet 2>/dev/null)

if [ "$DB_EXISTS" != "-1" ]; then
    echo "⚠️  Dev database already exists!"
    read -p "Do you want to overwrite? (yes/no): " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Aborted."
        exit 1
    fi
    echo "Dropping existing dev database..."
    mongosh "$MONGO_URI" --eval "use $TARGET_DB; db.dropDatabase()" --quiet
fi

echo ""
echo "Starting database copy..."
echo "This may take a few minutes..."
echo ""

# Get all collections from source database
COLLECTIONS=$(mongosh "$MONGO_URI" --eval "use $SOURCE_DB; db.getCollectionNames().join(' ')" --quiet 2>/dev/null)

if [ -z "$COLLECTIONS" ]; then
    echo "❌ Error: Could not get collections from source database"
    exit 1
fi

echo "Found collections: $COLLECTIONS"
echo ""

# Copy each collection
for collection in $COLLECTIONS; do
    echo "Copying $collection..."
    mongosh "$MONGO_URI" --eval "
        use $SOURCE_DB;
        var docs = db.$collection.find().toArray();
        use $TARGET_DB;
        if (docs.length > 0) {
            db.$collection.insertMany(docs);
            print('  ✓ Copied ' + docs.length + ' documents');
        } else {
            print('  ⚠ Collection is empty');
        }
    " --quiet 2>/dev/null
done

echo ""
echo "======================================"
echo "✓ Database Copy Complete!"
echo "======================================"
echo ""
echo "Production DB: $SOURCE_DB (unchanged)"
echo "Dev DB: $TARGET_DB (ready for testing)"
echo ""
echo "You can now test on: http://156.67.111.95:4522"
echo ""
