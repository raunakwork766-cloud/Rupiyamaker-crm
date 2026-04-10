import os
from dotenv import load_dotenv

load_dotenv()   

class Config:
    """Base configuration class."""
    # Server Configuration
    HOST = os.getenv("HOST", "localhost")
    PORT = int(os.getenv("PORT", "8049"))
    BASE_URL = os.getenv("BASE_URL", f"http://{HOST}:{PORT}")
    
    # Database Configuration
    # MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin")
    COMPANY_NAME = os.getenv("COMPANY_NAME", "crm_database")  # Default database name
    
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    
    # CORS Settings
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://raunakcrm.bhoomitechzone.us:4521,https://raunakcrm.bhoomitechzone.us:3000").split(",")
    