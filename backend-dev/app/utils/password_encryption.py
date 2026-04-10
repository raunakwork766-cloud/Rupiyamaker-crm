"""
Password encryption utilities for reversible password storage
"""
import base64
from cryptography.fernet import Fernet
import os

class PasswordEncryption:
    def __init__(self):
        # Use environment variable or default key for encryption
        # In production, this should be stored securely
        encryption_key = os.getenv('PASSWORD_ENCRYPTION_KEY')
        if not encryption_key:
            # Generate a default key - in production, this should be stored securely
            encryption_key = 'ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg='
        
        self.key = encryption_key.encode() if isinstance(encryption_key, str) else encryption_key
        self.fernet = Fernet(self.key)
    
    def encrypt_password(self, plain_password: str) -> str:
        """Encrypt a plain text password"""
        if not plain_password:
            return ""
        
        # Convert to bytes and encrypt
        encrypted_bytes = self.fernet.encrypt(plain_password.encode())
        # Convert to base64 string for storage
        return base64.b64encode(encrypted_bytes).decode()
    
    def decrypt_password(self, encrypted_password: str) -> str:
        """Decrypt an encrypted password"""
        if not encrypted_password:
            return ""
        
        try:
            # Convert from base64 string to bytes
            encrypted_bytes = base64.b64decode(encrypted_password.encode())
            # Decrypt and convert back to string
            decrypted_bytes = self.fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            # If decryption fails, might be an old bcrypt hash
            return encrypted_password  # Return as-is for backward compatibility
    
    def is_encrypted_password(self, password: str) -> bool:
        """Check if a password is encrypted (not a bcrypt hash)"""
        # Bcrypt hashes start with $2b$ or similar
        # Our encrypted passwords are base64 encoded
        if password.startswith('$2'):
            return False  # This is a bcrypt hash
        
        try:
            # Try to decode as base64 - if it works, likely encrypted
            base64.b64decode(password.encode())
            return True
        except:
            return False  # Not base64, likely plain text

# Global instance
password_encryptor = PasswordEncryption()
