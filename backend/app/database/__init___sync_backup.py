from app.config import Config 
from pymongo import MongoClient
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern
import logging
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    logger.info("🚀 Connecting to MongoDB with high-performance settings...")
    
    # ⚡ HIGH-PERFORMANCE MongoDB Configuration
    client = MongoClient(
        Config.MONGO_URI,
        # Connection pooling for high concurrency
        maxPoolSize=100,          # Max connections in pool (for 10K+ requests)
        minPoolSize=10,           # Keep minimum connections open
        maxIdleTimeMS=30000,      # Close idle connections after 30s
        
        # Timeouts optimized for speed
        serverSelectionTimeoutMS=2000,  # Faster server selection
        connectTimeoutMS=5000,          # Connection timeout
        socketTimeoutMS=10000,          # Socket timeout
        
        # Performance optimizations
        retryWrites=True,              # Retry writes for reliability
        retryReads=True,               # Retry reads for reliability
        readPreference='primaryPreferred',  # Read from primary when possible
        
        # Connection efficiency (remove snappy as it's not installed)
        compressors='zlib',            # Use zlib compression only
        zlibCompressionLevel=6,        # Balanced compression
        
        # High concurrency settings
        waitQueueTimeoutMS=5000,       # Queue timeout for connections
        heartbeatFrequencyMS=5000,     # Reduced heartbeat frequency
        
        # Write concern for performance (fixed - use proper parameter name)
        w=1,                           # Acknowledge writes to primary only
        
        # Connection stability
        maxConnecting=10,              # Max simultaneous connections
    )
    
    # Test the connection with faster timeout
    client.admin.command('ping')
    logger.info("✓ MongoDB high-performance connection established")
    
    # ⚡ Database with optimized settings
    db = client['crm_database']
    
    # ⚡ Enable read concern for consistency vs performance balance
    db = db.with_options(
        read_concern=ReadConcern(level='local'),  # Faster reads
        write_concern=WriteConcern(w=1, j=False)  # Faster writes, don't wait for journal
    )
    
    logger.info(f"✓ Database optimized for 10K+ concurrent requests")
    logger.info(f"✓ Connection pool: {client.max_pool_size} max connections")
    
except Exception as e:
    logger.error(f"✗ Failed to connect to MongoDB: {str(e)}")
    raise e  