"""
High-Performance SQLite Database for Company Data
Optimized for 10L+ records with sub-second search performance
"""
import sqlite3
import json
import pandas as pd
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import threading
import os

class CompanyDataSQLite:
    def __init__(self, db_path: str = "../data/company_data.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._ensure_db_exists()
        self._create_indexes()
    
    def _deserialize_json_fields(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Helper method to deserialize JSON fields"""
        if not record:
            return record
            
        # Deserialize JSON fields
        try:
            record['bank_names'] = json.loads(record.get('bank_names', '[]'))
        except:
            record['bank_names'] = []
        
        try:
            record['categories'] = json.loads(record.get('categories', '[]'))
        except:
            record['categories'] = []
        
        try:
            record['additional_data'] = json.loads(record.get('additional_data', '{}'))
        except:
            record['additional_data'] = {}
        
        return record
    
    def _ensure_db_exists(self):
        """Create database and table if they don't exist"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id TEXT PRIMARY KEY,
                    _id TEXT UNIQUE NOT NULL,
                    company_name TEXT NOT NULL,
                    company_name_lower TEXT NOT NULL,  -- For fast case-insensitive search
                    bank TEXT,
                    bank_names TEXT,  -- JSON array as text
                    categories TEXT,  -- JSON array as text
                    is_active BOOLEAN DEFAULT 1,
                    created_at TEXT,
                    updated_at TEXT,
                    -- Additional fields for Excel data
                    address TEXT,
                    phone TEXT,
                    email TEXT,
                    website TEXT,
                    contact_person TEXT,
                    additional_data TEXT  -- JSON for flexible schema
                )
            """)
            
            # WAL mode for better concurrent performance
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=10000")
            conn.execute("PRAGMA temp_store=memory")
            conn.execute("PRAGMA mmap_size=268435456")  # 256MB
    
    def _create_indexes(self):
        """Create optimized indexes for fast searches"""
        with sqlite3.connect(self.db_path) as conn:
            # Primary search indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_company_name_lower ON companies(company_name_lower)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_company_name_like ON companies(company_name_lower)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_bank ON companies(bank)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_is_active ON companies(is_active)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON companies(created_at)")
            
            # Full-text search index for advanced searching
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS companies_fts USING fts5(
                    id, company_name, bank, categories, content='companies'
                )
            """)
    
    def get_all(self, limit: int = None, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all records with pagination - FAST"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            query = "SELECT * FROM companies WHERE is_active = 1 ORDER BY created_at DESC"
            if limit:
                query += f" LIMIT {limit} OFFSET {offset}"
            
            cursor = conn.execute(query)
            results = []
            for row in cursor.fetchall():
                record = self._deserialize_json_fields(dict(row))
                results.append(record)
            return results
    
    def get_by_id(self, record_id: str) -> Optional[Dict[str, Any]]:
        """Get single record by ID - INSTANT"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM companies WHERE _id = ? OR id = ?", (record_id, record_id))
            row = cursor.fetchone()
            if row:
                return self._deserialize_json_fields(dict(row))
            return None
    
    def create(self, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new record - FAST"""
        with sqlite3.connect(self.db_path) as conn:
            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            company_name = record_data.get('company_name', '')
            
            conn.execute("""
                INSERT INTO companies (
                    id, _id, company_name, company_name_lower, bank, bank_names, 
                    categories, is_active, created_at, updated_at, address, 
                    phone, email, website, contact_person, additional_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                new_id, new_id, company_name, company_name.lower(),
                record_data.get('bank', ''),
                json.dumps(record_data.get('bank_names', [])),
                json.dumps(record_data.get('categories', [])),
                record_data.get('is_active', True),
                now, now,
                record_data.get('address', ''),
                record_data.get('phone', ''),
                record_data.get('email', ''),
                record_data.get('website', ''),
                record_data.get('contact_person', ''),
                json.dumps(record_data.get('additional_data', {}))
            ))
            
            # Update FTS index
            conn.execute("""
                INSERT INTO companies_fts (id, company_name, bank, categories)
                VALUES (?, ?, ?, ?)
            """, (
                new_id, company_name, 
                record_data.get('bank', ''),
                ' '.join(record_data.get('categories', []))
            ))
            
            record_data.update({
                '_id': new_id,
                'id': new_id,
                'created_at': now,
                'updated_at': now
            })
            
            return record_data
    
    def update(self, record_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update existing record by ID"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Check if record exists
            cursor = conn.execute("SELECT * FROM companies WHERE (_id = ? OR id = ?) AND is_active = 1", (record_id, record_id))
            existing = cursor.fetchone()
            if not existing:
                return None
            
            # Prepare update fields
            update_fields = []
            update_values = []
            
            if 'company_name' in update_data:
                update_fields.extend(['company_name', 'company_name_lower'])
                update_values.extend([update_data['company_name'], update_data['company_name'].lower()])
            
            if 'bank' in update_data:
                update_fields.append('bank')
                update_values.append(update_data['bank'])
            
            if 'bank_names' in update_data:
                update_fields.append('bank_names')
                update_values.append(json.dumps(update_data['bank_names']))
            
            if 'categories' in update_data:
                update_fields.append('categories')
                update_values.append(json.dumps(update_data['categories']))
            
            for field in ['address', 'phone', 'email', 'website', 'contact_person']:
                if field in update_data:
                    update_fields.append(field)
                    update_values.append(update_data[field])
            
            if 'additional_data' in update_data:
                update_fields.append('additional_data')
                update_values.append(json.dumps(update_data['additional_data']))
            
            if 'is_active' in update_data:
                update_fields.append('is_active')
                update_values.append(update_data['is_active'])
            
            # Always update the updated_at timestamp
            update_fields.append('updated_at')
            update_values.append(datetime.now().isoformat())
            
            if not update_fields:
                # No fields to update, return existing record
                return self._deserialize_json_fields(dict(existing))
            
            # Build and execute update query
            set_clause = ', '.join([f"{field} = ?" for field in update_fields])
            update_values.append(record_id)  # For WHERE clause
            
            conn.execute(f"""
                UPDATE companies 
                SET {set_clause}
                WHERE (_id = ? OR id = ?) AND is_active = 1
            """, update_values + [record_id])
            
            # Update FTS if name or other searchable fields changed
            if any(field in update_data for field in ['company_name', 'bank', 'categories']):
                company_name = update_data.get('company_name', existing['company_name'])
                bank = update_data.get('bank', existing['bank'])
                categories = update_data.get('categories', json.loads(existing['categories'] or '[]'))
                
                conn.execute("""
                    UPDATE companies_fts 
                    SET company_name = ?, bank = ?, categories = ?
                    WHERE id = ?
                """, (company_name, bank, ' '.join(categories) if isinstance(categories, list) else '', record_id))
            
            # Return updated record
            cursor = conn.execute("SELECT * FROM companies WHERE (_id = ? OR id = ?) AND is_active = 1", (record_id, record_id))
            updated_row = cursor.fetchone()
            if updated_row:
                return self._deserialize_json_fields(dict(updated_row))
            return None
    
    def delete(self, record_id: str) -> bool:
        """Soft delete a record by ID"""
        with sqlite3.connect(self.db_path) as conn:
            try:
                # Check if record exists
                cursor = conn.execute("SELECT id FROM companies WHERE (_id = ? OR id = ?) AND is_active = 1", (record_id, record_id))
                existing = cursor.fetchone()
                if not existing:
                    return False
                
                # Soft delete (set is_active = 0)
                cursor = conn.execute("""
                    UPDATE companies 
                    SET is_active = 0, updated_at = ?
                    WHERE (_id = ? OR id = ?) AND is_active = 1
                """, (datetime.now().isoformat(), record_id, record_id))
                
                # Remove from FTS index
                conn.execute("DELETE FROM companies_fts WHERE id = ?", (record_id,))
                
                return cursor.rowcount > 0
                
            except Exception as e:
                print(f"Error deleting record {record_id}: {e}")
                return False
    
    def search_by_name(self, company_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Ultra-fast company name search with ranking"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            search_term = company_name.lower().strip()
            
            # Multi-strategy search with ranking
            query = """
                SELECT *, 
                CASE 
                    WHEN company_name_lower = ? THEN 1000
                    WHEN company_name_lower LIKE ? || '%' THEN 900
                    WHEN company_name_lower LIKE '%' || ? || '%' THEN 700
                    ELSE 500
                END as rank_score
                FROM companies 
                WHERE is_active = 1 AND (
                    company_name_lower = ? OR
                    company_name_lower LIKE ? || '%' OR
                    company_name_lower LIKE '%' || ? || '%'
                )
                ORDER BY rank_score DESC, company_name_lower
                LIMIT ?
            """
            
            cursor = conn.execute(query, (
                search_term, search_term, search_term,
                search_term, search_term, search_term,
                limit
            ))
            
            results = []
            for row in cursor.fetchall():
                record = dict(row)
                # Deserialize JSON fields
                try:
                    record['bank_names'] = json.loads(record.get('bank_names', '[]'))
                except:
                    record['bank_names'] = []
                try:
                    record['categories'] = json.loads(record.get('categories', '[]'))
                except:
                    record['categories'] = []
                try:
                    record['additional_data'] = json.loads(record.get('additional_data', '{}'))
                except:
                    record['additional_data'] = {}
                results.append(record)
            return results
    
    def filter_by_bank(self, bank_name: str) -> List[Dict[str, Any]]:
        """Filter by bank - FAST with index"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Search in both bank field and bank_names JSON array
            cursor = conn.execute("""
                SELECT * FROM companies 
                WHERE is_active = 1 AND (
                    bank = ? OR 
                    bank_names LIKE '%"' || ? || '"%'
                )
                ORDER BY company_name_lower
            """, (bank_name, bank_name))
            
            results = []
            for row in cursor.fetchall():
                record = dict(row)
                # Deserialize JSON fields
                try:
                    record['bank_names'] = json.loads(record.get('bank_names', '[]'))
                except:
                    record['bank_names'] = []
                try:
                    record['categories'] = json.loads(record.get('categories', '[]'))
                except:
                    record['categories'] = []
                try:
                    record['additional_data'] = json.loads(record.get('additional_data', '{}'))
                except:
                    record['additional_data'] = {}
                results.append(record)
            return results
    
    def bulk_upsert_from_excel(self, excel_file_path: str, chunk_size: int = 10000) -> Dict[str, int]:
        """Ultra-fast bulk import from Excel file"""
        stats = {'created': 0, 'updated': 0, 'errors': 0, 'total_processed': 0}
        
        try:
            # Read Excel file at once (pandas doesn't support chunksize for Excel)
            df = pd.read_excel(excel_file_path)
            df = df.fillna('')
            
            total_rows = len(df)
            print(f"Processing {total_rows} records from Excel file")
            
            # Process in chunks for memory efficiency
            for i in range(0, total_rows, chunk_size):
                chunk_df = df.iloc[i:i + chunk_size]
                chunk_stats = self._process_chunk(chunk_df)
                stats['created'] += chunk_stats['created']
                stats['updated'] += chunk_stats['updated']
                stats['errors'] += chunk_stats['errors']
                stats['total_processed'] += len(chunk_df)
                
                print(f"Processed chunk: {len(chunk_df)} records. Total: {stats['total_processed']}/{total_rows}")
        
        except Exception as e:
            print(f"Error in bulk upsert: {e}")
            stats['errors'] += 1
        
        return stats
    
    def _process_chunk(self, df: pd.DataFrame) -> Dict[str, int]:
        """Process a chunk of DataFrame with optimized bulk operations"""
        stats = {'created': 0, 'updated': 0, 'errors': 0}
        
        # Prepare data - normalize column names to handle variations
        df = df.fillna('')
        df.columns = df.columns.str.strip().str.upper()
        
        # Map column variations
        column_mapping = {
            'COMPANY NAME': 'company_name',
            'COMPANY_NAME': 'company_name', 
            'COMPANYNAME': 'company_name',
            'NAME': 'company_name',
            'CATEGORIES': 'categories',
            'CATEGORY': 'categories',
            'BANK': 'bank',
            'BANK_NAME': 'bank',
            'BANKNAME': 'bank'
        }
        
        records = []
        
        for _, row in df.iterrows():
            try:
                # Extract company name with flexible column matching
                company_name = ''
                for col in ['COMPANY NAME', 'COMPANY_NAME', 'COMPANYNAME', 'NAME']:
                    if col in row and str(row[col]).strip():
                        company_name = str(row[col]).strip()
                        break
                
                if not company_name:
                    stats['errors'] += 1
                    continue
                
                # Extract bank
                bank = ''
                for col in ['BANK', 'BANK_NAME', 'BANKNAME']:
                    if col in row and str(row[col]).strip():
                        bank = str(row[col]).strip()
                        break
                
                # Extract categories
                categories_str = ''
                for col in ['CATEGORIES', 'CATEGORY']:
                    if col in row and str(row[col]).strip():
                        categories_str = str(row[col]).strip()
                        break
                
                # Parse categories - handle comma-separated values
                categories = []
                if categories_str:
                    categories = [cat.strip() for cat in categories_str.split(',') if cat.strip()]
                
                record = {
                    'company_name': company_name,
                    'company_name_lower': company_name.lower(),
                    'bank': bank,
                    'bank_names': json.dumps([bank]) if bank else json.dumps([]),
                    'categories': json.dumps(categories),
                    'address': '',  # Not in your Excel
                    'phone': '',    # Not in your Excel
                    'email': '',    # Not in your Excel
                    'website': '',  # Not in your Excel
                    'contact_person': '',  # Not in your Excel
                    'is_active': True,
                    'updated_at': datetime.now().isoformat()
                }
                records.append(record)
                
            except Exception as e:
                print(f"Error processing row: {e}")
                stats['errors'] += 1
        
        # Bulk upsert using transaction
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute("BEGIN TRANSACTION")
                
                for record in records:
                    # Check if exists
                    cursor = conn.execute(
                        "SELECT id FROM companies WHERE company_name_lower = ?",
                        (record['company_name_lower'],)
                    )
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update
                        conn.execute("""
                            UPDATE companies SET 
                                bank = ?, bank_names = ?, categories = ?, 
                                address = ?, phone = ?, email = ?, website = ?, 
                                contact_person = ?, updated_at = ?
                            WHERE company_name_lower = ?
                        """, (
                            record['bank'], record['bank_names'], record['categories'],
                            record['address'], record['phone'], record['email'], 
                            record['website'], record['contact_person'], 
                            record['updated_at'], record['company_name_lower']
                        ))
                        stats['updated'] += 1
                    else:
                        # Create
                        new_id = str(uuid.uuid4())
                        now = datetime.now().isoformat()
                        
                        conn.execute("""
                            INSERT INTO companies (
                                id, _id, company_name, company_name_lower, bank, bank_names,
                                categories, address, phone, email, website, contact_person,
                                is_active, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            new_id, new_id, record['company_name'], record['company_name_lower'],
                            record['bank'], record['bank_names'], record['categories'],
                            record['address'], record['phone'], record['email'], 
                            record['website'], record['contact_person'],
                            True, now, now
                        ))
                        
                        # Update FTS
                        conn.execute("""
                            INSERT INTO companies_fts (id, company_name, bank, categories)
                            VALUES (?, ?, ?, ?)
                        """, (new_id, record['company_name'], record['bank'], record['categories']))
                        
                        stats['created'] += 1
                
                conn.execute("COMMIT")
                
            except Exception as e:
                conn.execute("ROLLBACK")
                print(f"Transaction error: {e}")
                stats['errors'] += len(records)
        
        return stats
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) as total FROM companies WHERE is_active = 1")
            total = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(DISTINCT bank) as unique_banks FROM companies WHERE is_active = 1 AND bank != ''")
            unique_banks = cursor.fetchone()[0]
            
            # Get file size
            file_size = os.path.getsize(self.db_path) / (1024 * 1024)  # MB
            
            return {
                'total_companies': total,
                'unique_banks': unique_banks,
                'database_size_mb': round(file_size, 2)
            }
    
    def get_unique_banks(self) -> List[str]:
        """Get list of all unique banks"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT DISTINCT bank 
                FROM companies 
                WHERE is_active = 1 AND bank != '' 
                ORDER BY bank
            """)
            banks = [row[0] for row in cursor.fetchall()]
            return banks
    
    def delete_by_bank(self, bank_name: str) -> Dict[str, Any]:
        """Delete all companies associated with a specific bank"""
        with sqlite3.connect(self.db_path) as conn:
            try:
                conn.execute("BEGIN TRANSACTION")
                
                # First, get count of companies to be deleted
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM companies 
                    WHERE is_active = 1 AND (
                        bank = ? OR 
                        bank_names LIKE '%"' || ? || '"%'
                    )
                """, (bank_name, bank_name))
                count_to_delete = cursor.fetchone()[0]
                
                if count_to_delete == 0:
                    conn.execute("ROLLBACK")
                    return {
                        'success': True,
                        'deleted': 0,
                        'deleted_count': 0,
                        'remaining': 0,
                        'message': f'No companies found for bank: {bank_name}'
                    }
                
                # Get IDs of companies to be deleted for FTS cleanup
                cursor = conn.execute("""
                    SELECT id FROM companies 
                    WHERE is_active = 1 AND (
                        bank = ? OR 
                        bank_names LIKE '%"' || ? || '"%'
                    )
                """, (bank_name, bank_name))
                company_ids = [row[0] for row in cursor.fetchall()]
                
                # Soft delete companies (set is_active = 0)
                cursor = conn.execute("""
                    UPDATE companies 
                    SET is_active = 0, updated_at = ?
                    WHERE is_active = 1 AND (
                        bank = ? OR 
                        bank_names LIKE '%"' || ? || '"%'
                    )
                """, (datetime.now().isoformat(), bank_name, bank_name))
                
                # Remove from FTS index
                for company_id in company_ids:
                    conn.execute("DELETE FROM companies_fts WHERE id = ?", (company_id,))
                
                conn.execute("COMMIT")
                
                # Get remaining count for this bank
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM companies 
                    WHERE is_active = 1 AND (
                        bank = ? OR 
                        bank_names LIKE '%"' || ? || '"%'
                    )
                """, (bank_name, bank_name))
                remaining_count = cursor.fetchone()[0]
                
                return {
                    'success': True,
                    'deleted': count_to_delete,
                    'deleted_count': count_to_delete,
                    'remaining': remaining_count,
                    'message': f'Successfully deleted {count_to_delete} companies for bank: {bank_name}'
                }
                
            except Exception as e:
                conn.execute("ROLLBACK")
                return {
                    'success': False,
                    'deleted': 0,
                    'deleted_count': 0,
                    'remaining': 0,
                    'message': f'Error deleting companies for bank {bank_name}: {str(e)}'
                }

# Global instance
company_db = CompanyDataSQLite()
