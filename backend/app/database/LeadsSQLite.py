"""
SQLite Database for Leads Management
===================================
Migrated from MongoDB to SQLite for better performance and simpler deployment
"""

import sqlite3
import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any, Union, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def sanitize_value_for_sqlite(key: str, value: Any) -> Any:
    """Sanitize a value for SQLite storage"""
    if value is None:
        if key in ['loan_amount', 'credit_score', 'annual_income']:
            return 0.0  # Numeric fields default to 0.0
        elif key in ['is_deleted', 'form_share', 'file_sent_to_login']:
            return False  # Boolean fields default to False
        else:
            return ''  # String fields default to empty string
    elif isinstance(value, (int, float)) and str(value) == 'nan':  # Check for NaN
        return 0.0
    elif isinstance(value, str) and value.lower() in ['none', 'null']:
        return ''
    elif isinstance(value, bool):
        return value  # Keep boolean as is
    elif isinstance(value, (int, float)):
        return value  # Keep numbers as is
    else:
        return str(value)  # Convert everything else to string

class LeadsSQLiteDB:
    def __init__(self, db_path: str = "data/leads.db"):
        """Initialize SQLite database for leads"""
        self.db_path = db_path
        
        # Ensure data directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Initialize database and create tables
        self._create_tables()
        
        # Ensure media directory exists
        self.leads_media_root = Path("media/leads")
        self.leads_media_root.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"✓ SQLite Leads database initialized at {db_path}")

    def _get_connection(self):
        """Get database connection with row factory"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # This allows dict-like access to rows
        return conn

    def execute_raw_query(self, query: str, params: List[Any] = None) -> List[dict]:
        """Execute a raw SQL query and return results as list of dictionaries"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # For SELECT queries, return results
            if query.strip().upper().startswith('SELECT'):
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
            else:
                # For other queries (INSERT, UPDATE, DELETE), commit and return affected rows
                conn.commit()
                return [{"affected_rows": cursor.rowcount}]
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error executing raw query: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            raise
        finally:
            conn.close()

    def _create_tables(self):
        """Create the leads table and related tables"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Create leads table matching MongoDB structure exactly
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                custom_lead_id TEXT UNIQUE,
                
                -- Basic Information (matching MongoDB structure)
                first_name TEXT NOT NULL,
                last_name TEXT,
                email TEXT,
                phone TEXT,
                mobile_number TEXT,
                alternative_phone TEXT,
                address TEXT, -- JSON string for address object
                
                -- Loan Information
                loan_type TEXT,
                loan_type_id TEXT,
                loan_type_name TEXT,
                processing_bank TEXT,
                loan_amount REAL,
                
                -- Status and Priority
                status TEXT DEFAULT 'ACTIVE LEADS',
                sub_status TEXT DEFAULT 'NEW LEAD',
                priority TEXT DEFAULT 'medium',
                source TEXT,
                
                -- Campaign and Product
                campaign_name TEXT,
                data_code TEXT,
                product_name TEXT,
                
                -- Assignment and Department
                department_id TEXT,
                assigned_to TEXT, -- Single user ID or JSON array
                assign_report_to TEXT DEFAULT '[]', -- JSON array
                
                -- Dynamic fields as JSON (main nested structure)
                dynamic_fields TEXT DEFAULT '{}', -- JSON string containing all nested data
                
                -- Metadata
                form_share BOOLEAN DEFAULT true,
                created_by TEXT,
                created_by_name TEXT,
                created_by_role TEXT,
                department_name TEXT,
                
                -- Timestamps (matching MongoDB date format)
                created_date TEXT, -- ISO format datetime
                created_at TEXT, -- ISO format datetime  
                updated_at TEXT, -- ISO format datetime
                
                -- Reassignment fields (matching MongoDB structure)
                pending_reassignment BOOLEAN DEFAULT 0,
                reassignment_status TEXT DEFAULT 'none', -- 'none', 'requested', 'approved', 'rejected'
                reassignment_requested_by TEXT,
                reassignment_requested_by_name TEXT,
                reassignment_requested_at TEXT,
                reassignment_target_user TEXT,
                reassignment_target_user_name TEXT,
                reassignment_reason TEXT,
                reassignment_approved_by TEXT,
                reassignment_approved_by_name TEXT,
                reassignment_approved_at TEXT,
                reassignment_rejected_by TEXT,
                reassignment_rejected_by_name TEXT,
                reassignment_rejected_at TEXT,
                reassignment_rejection_reason TEXT,
                reassignment_new_data_code TEXT,
                reassignment_new_campaign_name TEXT,
                
                -- System fields
                is_active BOOLEAN DEFAULT 1,
                is_deleted BOOLEAN DEFAULT 0
            )
        """)

        # Create related tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_statuses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                color TEXT DEFAULT '#28a745',
                description TEXT,
                order_index INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT 1,
                is_final BOOLEAN DEFAULT 0,
                allows_reassignment BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_activities (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                description TEXT,
                created_by TEXT,
                created_by_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_notes (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                note TEXT NOT NULL,
                note_type TEXT DEFAULT 'general',
                created_by TEXT,
                created_by_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_private BOOLEAN DEFAULT 0
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_documents (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                document_name TEXT NOT NULL,
                document_type TEXT,
                file_path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                mime_type TEXT,
                uploaded_by TEXT,
                uploaded_by_name TEXT,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_transfers (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                from_user_id TEXT,
                to_user_id TEXT NOT NULL,
                from_department_id TEXT,
                to_department_id TEXT,
                transfer_reason TEXT,
                transfer_notes TEXT,
                transferred_by TEXT,
                transferred_by_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'completed'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_field_history (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT,
                changed_by_name TEXT,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                metadata TEXT DEFAULT '{}'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lead_reassignment_requests (
                id TEXT PRIMARY KEY,
                lead_id TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                requested_by_name TEXT,
                target_user_id TEXT NOT NULL,
                target_user_name TEXT,
                reason TEXT,
                new_data_code TEXT,
                new_campaign_name TEXT,
                status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
                requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
                processed_by TEXT,
                processed_by_name TEXT,
                processed_at TEXT,
                processing_notes TEXT,
                metadata TEXT DEFAULT '{}'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS counters (
                name TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            )
        """)
        
        # Initialize the lead counter
        cursor.execute("""
            INSERT OR IGNORE INTO counters (name, value) VALUES ('lead_id', 1000)
        """)

        # Create indexes
        self._create_indexes(cursor)
        
        # Insert default statuses
        self._insert_default_statuses(cursor)
        
        # Commit and close
        conn.commit()
        conn.close()
        
        logger.info("✓ SQLite tables and indexes created successfully")

    def _create_indexes(self, cursor):
        """Create indexes for better query performance"""
        indexes = [
            # Main performance indexes
            "CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)",
            "CREATE INDEX IF NOT EXISTS idx_leads_department_id ON leads(department_id)",
            "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_sub_status ON leads(sub_status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by)",
            "CREATE INDEX IF NOT EXISTS idx_leads_loan_type ON leads(loan_type)",
            "CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)",
            "CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)",
            "CREATE INDEX IF NOT EXISTS idx_leads_is_active ON leads(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_leads_is_deleted ON leads(is_deleted)",
            
            # Compound indexes for common queries
            "CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON leads(status, assigned_to)",
            "CREATE INDEX IF NOT EXISTS idx_leads_dept_status ON leads(department_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_active_created ON leads(is_active, created_at DESC)",
            
            # Foreign key indexes
            "CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON lead_activities(lead_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON lead_notes(lead_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON lead_documents(lead_id)",
            "CREATE INDEX IF NOT EXISTS idx_transfers_lead_id ON lead_transfers(lead_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_field_history_lead_id ON lead_field_history(lead_id, changed_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_reassignment_requests_lead_id ON lead_reassignment_requests(lead_id)",
            
            # Reassignment specific indexes
            "CREATE INDEX IF NOT EXISTS idx_leads_pending_reassignment ON leads(pending_reassignment)",
            "CREATE INDEX IF NOT EXISTS idx_leads_reassignment_status ON leads(reassignment_status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_reassignment_requested_by ON leads(reassignment_requested_by)",
            "CREATE INDEX IF NOT EXISTS idx_leads_reassignment_target_user ON leads(reassignment_target_user)",
            "CREATE INDEX IF NOT EXISTS idx_leads_reassignment_requested_at ON leads(reassignment_requested_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_reassignment_requests_status ON lead_reassignment_requests(status)",
            "CREATE INDEX IF NOT EXISTS idx_reassignment_requests_requested_by ON lead_reassignment_requests(requested_by)",
            "CREATE INDEX IF NOT EXISTS idx_reassignment_requests_target_user ON lead_reassignment_requests(target_user_id)",
            
            # Text search preparation (for FTS if needed later)
            "CREATE INDEX IF NOT EXISTS idx_leads_name_search ON leads(first_name, last_name)",
        ]
        
        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")

    def _insert_default_statuses(self, cursor):
        """Insert default lead statuses"""
        default_statuses = [
            ('new', 'New', '#28a745', 'New lead, not yet contacted', 1, True, False, True),
            ('contacted', 'Contacted', '#007bff', 'Lead has been contacted', 2, True, False, True),
            ('interested', 'Interested', '#ffc107', 'Lead shows interest', 3, True, False, True),
            ('qualified', 'Qualified', '#17a2b8', 'Lead is qualified', 4, True, False, True),
            ('proposal_sent', 'Proposal Sent', '#6f42c1', 'Proposal has been sent', 5, True, False, True),
            ('negotiation', 'Negotiation', '#fd7e14', 'In negotiation phase', 6, True, False, True),
            ('converted', 'Converted', '#28a745', 'Lead converted to customer', 7, True, True, False),
            ('rejected', 'Rejected', '#dc3545', 'Lead rejected our offer', 8, True, True, False),
            ('lost', 'Lost', '#6c757d', 'Lead lost to competitor', 9, True, True, False),
            ('inactive', 'Inactive', '#adb5bd', 'Lead is inactive', 10, True, False, True),
        ]
        
        for status_data in default_statuses:
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO lead_statuses 
                    (id, name, display_name, color, description, order_index, is_active, is_final, allows_reassignment)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (status_data[0], status_data[0], status_data[1], status_data[2], 
                     status_data[3], status_data[4], status_data[5], status_data[6], status_data[7]))
            except Exception as e:
                logger.warning(f"Status insertion warning: {e}")

    def _generate_id(self) -> str:
        """Generate a unique ID for records"""
        return str(uuid.uuid4())

    def _get_next_lead_id(self) -> int:
        """Get next auto-increment lead ID"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('UPDATE counters SET value = value + 1 WHERE name = ?', ('lead_id',))
            cursor.execute('SELECT value FROM counters WHERE name = ?', ('lead_id',))
            result = cursor.fetchone()
            conn.commit()
            return result[0] if result else 1
        except Exception as e:
            conn.rollback()
            logger.error(f"Error getting next lead ID: {e}")
            return 1
        finally:
            conn.close()

    def _row_to_dict(self, row) -> dict:
        """Convert SQLite row to dictionary"""
        if row is None:
            return None
        
        result = dict(row)
        
        # Convert JSON strings back to objects
        json_fields = ['assigned_to', 'assign_report_to', 'dynamic_fields', 'custom_fields', 'address', 'metadata', 'options', 'validation_rules', 'eligible_users', 'rules']
        for field in json_fields:
            if field in result and result[field]:
                try:
                    result[field] = json.loads(result[field])
                except (json.JSONDecodeError, TypeError):
                    pass  # Keep as string if not valid JSON
        
        # Use 'id' as '_id' for MongoDB compatibility
        if 'id' in result:
            result['_id'] = result['id']
        
        # Convert boolean fields
        bool_fields = ['form_share', 'file_sent_to_login', 'is_private', 'is_required', 'is_active', 'is_deleted', 'is_final', 'allows_reassignment', 'pending_reassignment']
        for field in bool_fields:
            if field in result and result[field] is not None:
                result[field] = bool(result[field])
        
        return result

    def create_lead(self, lead_data: dict) -> str:
        """Create a new lead matching MongoDB structure"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            lead_id = self._generate_id()
            custom_lead_id = self._get_next_lead_id()
            current_time = datetime.now().isoformat()
            
            # Prepare data with MongoDB-style structure
            data = {
                'id': lead_id,
                'custom_lead_id': f"LEAD-{custom_lead_id}",
                'created_date': current_time,
                'created_at': current_time,
                'updated_at': current_time,
                
                # Basic fields from lead_data
                'first_name': lead_data.get('first_name', ''),
                'last_name': lead_data.get('last_name', ''),
                'email': lead_data.get('email'),
                'phone': lead_data.get('phone', ''),
                'mobile_number': lead_data.get('mobile_number', ''),
                'alternative_phone': lead_data.get('alternative_phone', ''),
                
                # Loan information
                'loan_type': lead_data.get('loan_type', ''),
                'loan_type_id': lead_data.get('loan_type_id', ''),
                'loan_type_name': lead_data.get('loan_type_name', ''),
                'processing_bank': lead_data.get('processing_bank', ''),
                'loan_amount': lead_data.get('loan_amount', 0),
                
                # Status and priority
                'status': lead_data.get('status', 'ACTIVE LEADS'),
                'sub_status': lead_data.get('sub_status', 'NEW LEAD'),
                'priority': lead_data.get('priority', 'medium'),
                'source': lead_data.get('source'),
                
                # Campaign and product
                'campaign_name': lead_data.get('campaign_name', ''),
                'data_code': lead_data.get('data_code', ''),
                'product_name': lead_data.get('product_name'),
                
                # Assignment and department
                'department_id': lead_data.get('department_id', ''),
                'assigned_to': lead_data.get('assigned_to', ''),
                'assign_report_to': json.dumps(lead_data.get('assign_report_to', [])),
                
                # Metadata
                'form_share': lead_data.get('form_share', True),
                'created_by': lead_data.get('created_by', ''),
                'created_by_name': lead_data.get('created_by_name', ''),
                'created_by_role': lead_data.get('created_by_role', ''),
                'department_name': lead_data.get('department_name', ''),
                
                # System fields
                'is_active': True,
                'is_deleted': False
            }
            
            # Handle address as JSON
            if 'address' in lead_data and lead_data['address']:
                data['address'] = json.dumps(lead_data['address'])
            else:
                data['address'] = None
                
            # Handle dynamic_fields as comprehensive JSON
            dynamic_fields = lead_data.get('dynamic_fields', {})
            
            # Ensure dynamic_fields has the MongoDB structure
            if not isinstance(dynamic_fields, dict):
                dynamic_fields = {}
                
            # Add standard dynamic field structure if not present
            if 'address' not in dynamic_fields:
                dynamic_fields['address'] = {
                    'street': None,
                    'city': lead_data.get('city'),
                    'state': None,
                    'postal_code': None,
                    'pincode': lead_data.get('pincode'),
                    'country': None
                }
            
            if 'personal_details' not in dynamic_fields:
                dynamic_fields['personal_details'] = {
                    'occupation': lead_data.get('occupation'),
                    'employer_name': lead_data.get('employer_name'),
                    'employment_type': lead_data.get('employment_type'),
                    'years_of_experience': lead_data.get('years_of_experience'),
                    'company_name': lead_data.get('company_name'),
                    'company_type': lead_data.get('company_type'),
                    'company_category': lead_data.get('company_category', '')
                }
            
            if 'financial_details' not in dynamic_fields:
                dynamic_fields['financial_details'] = {
                    'monthly_income': lead_data.get('monthly_income'),
                    'annual_income': lead_data.get('annual_income'),
                    'partner_salary': lead_data.get('partner_salary'),
                    'yearly_bonus': lead_data.get('yearly_bonus'),
                    'bonus_division': lead_data.get('bonus_division'),
                    'foir_percent': lead_data.get('foir_percent', 60),
                    'bank_name': lead_data.get('bank_name'),
                    'account_number': lead_data.get('account_number'),
                    'ifsc_code': lead_data.get('ifsc_code'),
                    'cibil_score': lead_data.get('cibil_score', '')
                }
            
            if 'obligations' not in dynamic_fields:
                dynamic_fields['obligations'] = lead_data.get('obligations', [])
            
            if 'check_eligibility' not in dynamic_fields:
                dynamic_fields['check_eligibility'] = {
                    'company_category': dynamic_fields['personal_details'].get('company_category', ''),
                    'foir_percent': dynamic_fields['financial_details'].get('foir_percent', 60),
                    'custom_foir_percent': '',
                    'monthly_emi_can_pay': 0,
                    'tenure_months': '',
                    'tenure_years': '',
                    'roi': '',
                    'multiplier': 0,
                    'loan_eligibility_status': 'Not Eligible'
                }
            
            if 'process' not in dynamic_fields:
                dynamic_fields['process'] = {
                    'processing_bank': data['processing_bank'],
                    'loan_amount_required': data['loan_amount'],
                    'how_to_process': 'None',
                    'loan_type': data['loan_type'],
                    'required_tenure': None,
                    'case_type': 'Normal',
                    'year': None
                }
                
            if 'eligibility_details' not in dynamic_fields:
                dynamic_fields['eligibility_details'] = {
                    'totalIncome': '0',
                    'foirAmount': '0',
                    'totalObligations': '0',
                    'totalBtPos': '0',
                    'finalEligibility': '0',
                    'multiplierEligibility': '0'
                }
            
            data['dynamic_fields'] = json.dumps(dynamic_fields)
            
            # Handle None values - SQLite compatibility
            for key, value in data.items():
                if value is None:
                    if key in ['loan_amount']:
                        data[key] = 0  # Numeric fields default to 0
                    else:
                        data[key] = None  # Keep None for nullable fields
                elif isinstance(value, str) and value.lower() in ['none', 'null']:
                    data[key] = None
            
            # Get table columns
            cursor.execute("PRAGMA table_info(leads)")
            table_columns = [column[1] for column in cursor.fetchall()]
            
            # Filter data to only include existing columns
            filtered_data = {k: v for k, v in data.items() if k in table_columns}
            
            # Build INSERT query
            columns = list(filtered_data.keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join(columns)
            values = list(filtered_data.values())
            
            query = f'INSERT INTO leads ({column_names}) VALUES ({placeholders})'
            cursor.execute(query, values)
            
            # Log activity
            self._log_activity(cursor, lead_id, 'created', 'Lead created', 
                             data.get('created_by'), data.get('created_by_name'))
            
            conn.commit()
            logger.info(f"✓ Lead created with MongoDB structure, ID: {lead_id}")
            return lead_id
            
        except Exception as e:
            conn.rollback()
            logger.error(f"❌ Error creating lead: {e}")
            raise e
        finally:
            conn.close()

    def get_lead(self, lead_id: str) -> Optional[dict]:
        """Get a lead by ID"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)
        except Exception as e:
            logger.error(f"Error getting lead {lead_id}: {e}")
            return None
        finally:
            conn.close()

    def list_leads(self, filter_dict: dict = None, skip: int = 0, limit: int = 50, 
                   sort_by: str = "created_at", sort_order: int = -1) -> List[dict]:
        """List leads with filtering and pagination"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Build WHERE clause
            where_conditions = ['is_deleted = 0']
            params = []
            
            if filter_dict:
                for key, value in filter_dict.items():
                    if key.startswith('$'):
                        # Handle MongoDB-style operators
                        continue
                    if value is not None:
                        where_conditions.append(f'{key} = ?')
                        params.append(value)
            
            where_clause = ' AND '.join(where_conditions)
            
            # Build ORDER BY clause
            order_direction = 'DESC' if sort_order == -1 else 'ASC'
            order_clause = f'ORDER BY {sort_by} {order_direction}'
            
            # Build LIMIT clause
            limit_clause = f'LIMIT {limit} OFFSET {skip}' if limit > 0 else ''
            
            query = f'SELECT * FROM leads WHERE {where_clause} {order_clause} {limit_clause}'
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error listing leads: {e}")
            return []
        finally:
            conn.close()

    def search_leads(self, filter_dict: dict = None, skip: int = 0, limit: int = 50, 
                     sort_by: str = "created_at", sort_order: int = -1) -> List[dict]:
        """Search leads with filtering (alias for list_leads for compatibility)"""
        return self.list_leads(filter_dict, skip, limit, sort_by, sort_order)

    def update_lead(self, lead_id: str, update_data: dict, user_id: str) -> bool:
        """Update a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Prepare update data
            data = update_data.copy()
            data['updated_at'] = datetime.now().isoformat()
            
            # Convert complex fields to JSON strings
            json_fields = ['assigned_to', 'assign_report_to', 'dynamic_fields', 'custom_fields', 'address', 'processing_bank']
            for field in json_fields:
                if field in data and data[field] is not None:
                    if isinstance(data[field], (list, dict)):
                        data[field] = json.dumps(data[field])
            
            # Handle company_name if it's a list
            if 'company_name' in data and isinstance(data['company_name'], list):
                data['company_name'] = json.dumps(data['company_name'])
            
            # Handle None values - convert to empty strings or appropriate defaults for SQLite
            for key, value in data.items():
                if value is None:
                    if key in ['loan_amount', 'credit_score', 'annual_income']:
                        data[key] = 0  # Numeric fields default to 0
                    else:
                        data[key] = ''  # String fields default to empty string
                elif isinstance(value, (int, float)) and value != value:  # Check for NaN
                    data[key] = 0
            
            # Get table columns to filter out unknown fields
            cursor.execute("PRAGMA table_info(leads)")
            table_columns = [column[1] for column in cursor.fetchall()]
            
            # Filter data to only include existing columns
            filtered_data = {k: v for k, v in data.items() if k in table_columns}
            
            if not filtered_data:
                return False
            
            # Build UPDATE query
            set_clauses = [f'{key} = ?' for key in filtered_data.keys()]
            set_clause = ', '.join(set_clauses)
            
            # Debug: Check for None values in the final data and sanitize
            values = list(filtered_data.values())
            for i, value in enumerate(values):
                if value is None:
                    logger.warning(f"Found None value for column {list(filtered_data.keys())[i]}, replacing with empty string")
                    values[i] = ''
                elif isinstance(value, str) and value.lower() in ['none', 'null']:
                    logger.warning(f"Found 'None' string value for column {list(filtered_data.keys())[i]}, replacing with empty string")
                    values[i] = ''
            
            params = values + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ?'
            cursor.execute(query, params)
            
            if cursor.rowcount > 0:
                # Log activity
                self._log_activity(cursor, lead_id, 'updated', 'Lead updated', user_id)
                conn.commit()
                return True
            else:
                conn.rollback()
                return False
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def delete_lead(self, lead_id: str, user_id: str) -> bool:
        """Soft delete a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE leads 
                SET is_deleted = 1, deleted_at = ?, updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), datetime.now().isoformat(), lead_id))
            
            if cursor.rowcount > 0:
                # Log activity
                self._log_activity(cursor, lead_id, 'deleted', 'Lead deleted', user_id)
                conn.commit()
                return True
            else:
                conn.rollback()
                return False
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def _log_activity(self, cursor, lead_id: str, activity_type: str, description: str, 
                     user_id: str = None, user_name: str = None, metadata: dict = None):
        """Log an activity for a lead"""
        try:
            activity_id = self._generate_id()
            metadata_json = json.dumps(metadata) if metadata else None
            
            cursor.execute('''
                INSERT INTO lead_activities 
                (id, lead_id, activity_type, description, performed_by, performed_by_name, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (activity_id, lead_id, activity_type, description, user_id, user_name, metadata_json))
            
        except Exception as e:
            logger.error(f"Error logging activity: {e}")

    # Additional methods for documents, notes, activities, etc. would go here...
    # For brevity, I'll implement the core methods first

    def count_leads(self, filter_dict: dict = None) -> int:
        """Count leads matching the filter"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            where_conditions = ['is_deleted = 0']
            params = []
            
            if filter_dict:
                for key, value in filter_dict.items():
                    if key.startswith('$'):
                        continue
                    if value is not None:
                        where_conditions.append(f'{key} = ?')
                        params.append(value)
            
            where_clause = ' AND '.join(where_conditions)
            query = f'SELECT COUNT(*) FROM leads WHERE {where_clause}'
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            return result[0] if result else 0
            
        except Exception as e:
            logger.error(f"Error counting leads: {e}")
            return 0
        finally:
            conn.close()

    def create_media_path(self, lead_id: str) -> Path:
        """Create media directory for a lead"""
        lead_dir = self.leads_media_root / lead_id
        lead_dir.mkdir(parents=True, exist_ok=True)
        return lead_dir

    # Status management methods
    def get_status_by_id(self, status_id: str) -> Optional[dict]:
        """Get a status by ID"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM lead_statuses WHERE id = ? AND is_active = 1', (status_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)
        except Exception as e:
            logger.error(f"Error getting status {status_id}: {e}")
            return None
        finally:
            conn.close()

    def get_sub_status_by_id(self, sub_status_id: str) -> Optional[dict]:
        """Get a sub-status by ID"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM lead_sub_statuses WHERE id = ? AND is_active = 1', (sub_status_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row)
        except Exception as e:
            logger.error(f"Error getting sub-status {sub_status_id}: {e}")
            return None
        finally:
            conn.close()

    def assign_lead(self, lead_id: str, user_id: str, assigned_by: str, notes: str = None) -> bool:
        """Assign a lead to a user"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            update_data = {
                'assigned_to': user_id,
                'updated_at': datetime.now().isoformat()
            }
            
            # Build UPDATE query
            set_clauses = [f'{key} = ?' for key in update_data.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(update_data.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ? AND is_deleted = 0'
            cursor.execute(query, values)
            
            if cursor.rowcount > 0:
                # Log activity
                activity_note = f"Lead assigned to user {user_id}"
                if notes:
                    activity_note += f" - Notes: {notes}"
                self._log_activity(cursor, lead_id, 'assigned', activity_note, assigned_by)
                conn.commit()
                return True
            else:
                conn.rollback()
                return False
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error assigning lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def add_reporting_user(self, lead_id: str, user_id: str, added_by: str) -> bool:
        """Add a user to the lead's reporting list"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Get current lead
            cursor.execute('SELECT assign_report_to FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            # Parse current reporters
            current_reporters = json.loads(row[0]) if row[0] else []
            
            # Add new reporter if not already present
            if user_id not in current_reporters:
                current_reporters.append(user_id)
                
                # Update the lead
                cursor.execute('UPDATE leads SET assign_report_to = ?, updated_at = ? WHERE id = ?', 
                             (json.dumps(current_reporters), datetime.now().isoformat(), lead_id))
                
                # Log activity
                self._log_activity(cursor, lead_id, 'reporter_added', f"Reporter {user_id} added", added_by)
                conn.commit()
                return True
            
            return True  # Already exists
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error adding reporter to lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def remove_reporting_user(self, lead_id: str, user_id: str, removed_by: str) -> bool:
        """Remove a user from the lead's reporting list"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Get current lead
            cursor.execute('SELECT assign_report_to FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            # Parse current reporters
            current_reporters = json.loads(row[0]) if row[0] else []
            
            # Remove reporter if present
            if user_id in current_reporters:
                current_reporters.remove(user_id)
                
                # Update the lead
                cursor.execute('UPDATE leads SET assign_report_to = ?, updated_at = ? WHERE id = ?', 
                             (json.dumps(current_reporters), datetime.now().isoformat(), lead_id))
                
                # Log activity
                self._log_activity(cursor, lead_id, 'reporter_removed', f"Reporter {user_id} removed", removed_by)
                conn.commit()
                return True
            
            return True  # Already removed
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error removing reporter from lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def transfer_lead(self, lead_id: str, to_user_id: str, to_department_id: str, 
                     transferred_by: str, notes: str = None, reporting_option: str = "preserve") -> bool:
        """Transfer a lead to another department and user"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Get current lead data for transfer history
            cursor.execute('SELECT assigned_to, department_id FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            old_user_id, old_department_id = row
            
            # Prepare update data
            update_data = {
                'assigned_to': to_user_id,
                'department_id': to_department_id,
                'updated_at': datetime.now().isoformat()
            }
            
            # Handle reporting option
            if reporting_option == "reset":
                update_data['assign_report_to'] = '[]'
            # preserve and merge keep existing reporters
            
            # Update the lead
            set_clauses = [f'{key} = ?' for key in update_data.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(update_data.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ?'
            cursor.execute(query, values)
            
            # Log transfer activity
            transfer_note = f"Lead transferred from user {old_user_id} (dept: {old_department_id}) to user {to_user_id} (dept: {to_department_id})"
            if notes:
                transfer_note += f" - Notes: {notes}"
            
            self._log_activity(cursor, lead_id, 'transferred', transfer_note, transferred_by)
            
            # Log transfer history
            self._log_transfer_history(cursor, lead_id, old_user_id, to_user_id, 
                                     old_department_id, to_department_id, transferred_by, notes)
            
            conn.commit()
            return True
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error transferring lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def get_transfer_history(self, lead_id: str) -> List[dict]:
        """Get transfer history for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM transfer_history 
                WHERE lead_id = ? 
                ORDER BY transferred_at DESC
            """, (lead_id,))
            
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error getting transfer history for lead {lead_id}: {e}")
            return []
        finally:
            conn.close()

    def get_lead_activities(self, lead_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get activity timeline for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT * FROM lead_activities 
                WHERE lead_id = ? 
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """
            
            cursor.execute(query, (lead_id, limit, skip))
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error getting activities for lead {lead_id}: {e}")
            return []
        finally:
            conn.close()

    def get_default_reporters_for_department(self, department_id: str) -> List[str]:
        """Get default reporters for a department (placeholder implementation)"""
        # This would need integration with departments/roles database
        # For now, return empty list
        return []

    def get_eligible_assignees(self, department_id: str, user_id: str = None) -> List[dict]:
        """Get eligible assignees for leads in a department (placeholder implementation)"""
        # This would need integration with users database to get TL users
        # For now, return empty list
        return []

    def get_tl_users_in_department(self, department_id: str, exclude_user_id: str = None) -> List[dict]:
        """Get Team Leader users in a department (placeholder implementation)"""
        # This would need integration with users database
        # For now, return empty list
        return []

    def count_leads(self, filter_dict: dict = None) -> int:
        """Count leads matching the filter"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Build WHERE clause
            where_conditions = ['is_deleted = 0']
            params = []
            
            if filter_dict:
                for key, value in filter_dict.items():
                    if key.startswith('$'):
                        # Handle MongoDB-style operators (simplified)
                        continue
                    if value is not None:
                        where_conditions.append(f'{key} = ?')
                        params.append(value)
            
            where_clause = ' AND '.join(where_conditions)
            query = f'SELECT COUNT(*) FROM leads WHERE {where_clause}'
            
            cursor.execute(query, params)
            return cursor.fetchone()[0]
            
        except Exception as e:
            logger.error(f"Error counting leads: {e}")
            return 0
        finally:
            conn.close()

    def _log_transfer_history(self, cursor, lead_id: str, from_user_id: str, to_user_id: str,
                             from_department_id: str, to_department_id: str, transferred_by: str, notes: str = None):
        """Log transfer history"""
        transfer_data = {
            'id': str(uuid.uuid4()),
            'lead_id': lead_id,
            'from_user_id': from_user_id,
            'to_user_id': to_user_id,
            'from_department_id': from_department_id,
            'to_department_id': to_department_id,
            'transferred_by': transferred_by,
            'notes': notes or '',
            'transferred_at': datetime.now().isoformat()
        }
        
        columns = list(transfer_data.keys())
        placeholders = ', '.join(['?' for _ in columns])
        column_names = ', '.join(columns)
        
        query = f'INSERT INTO transfer_history ({column_names}) VALUES ({placeholders})'
        cursor.execute(query, list(transfer_data.values()))

    def check_reassignment_eligibility(self, lead_id: str) -> dict:
        """Check if a lead is eligible for reassignment"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT status, created_at FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            
            if not row:
                return {"can_reassign": False, "reason": "Lead not found"}
            
            status, created_at = row
            
            # Parse created_at
            try:
                created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                days_old = (datetime.now() - created_date).days
            except:
                days_old = 0
            
            # Simple eligibility rules (can be expanded)
            if days_old > 15:
                return {"can_reassign": True, "reason": "Lead is older than 15 days"}
            elif status in ['new', 'pending']:
                return {"can_reassign": True, "reason": "Lead status allows reassignment"}
            else:
                return {"can_reassign": False, "reason": "Lead is in active processing"}
                
        except Exception as e:
            logger.error(f"Error checking reassignment eligibility for lead {lead_id}: {e}")
            return {"can_reassign": False, "reason": "Error checking eligibility"}
        finally:
            conn.close()

    def is_lead_visible_to_user(self, lead_id: str, user_id: str, user_role: dict, 
                               user_permissions: List[dict], roles_db) -> bool:
        """Check if a lead is visible to a user (simplified implementation)"""
        # This would need more complex permission logic
        # For now, return True (can be enhanced later)
        return True

    # Document Management Methods
    def create_media_path(self, lead_id: str) -> str:
        """Create media directory path for a lead"""
        import os
        media_path = f"media/leads/{lead_id}"
        os.makedirs(media_path, exist_ok=True)
        return media_path

    def add_document(self, document_data: dict) -> str:
        """Add a document to a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            document_id = str(uuid.uuid4())
            
            # Prepare document data
            data = document_data.copy()
            data['id'] = document_id
            data['created_at'] = datetime.now().isoformat()
            data['updated_at'] = datetime.now().isoformat()
            
            # Sanitize data
            for key, value in data.items():
                data[key] = sanitize_value_for_sqlite(key, value)
            
            # Get table columns
            cursor.execute("PRAGMA table_info(documents)")
            table_columns = [column[1] for column in cursor.fetchall()]
            
            # Filter data
            filtered_data = {k: v for k, v in data.items() if k in table_columns}
            
            # Insert document
            columns = list(filtered_data.keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join(columns)
            
            query = f'INSERT INTO documents ({column_names}) VALUES ({placeholders})'
            cursor.execute(query, list(filtered_data.values()))
            
            conn.commit()
            return document_id
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error adding document: {e}")
            raise
        finally:
            conn.close()

    def get_lead_documents(self, lead_id: str) -> List[dict]:
        """Get all documents for a lead"""
        return self.get_documents(lead_id)

    def get_documents(self, lead_id: str) -> List[dict]:
        """Get documents for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM documents WHERE lead_id = ? ORDER BY created_at DESC', (lead_id,))
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error getting documents for lead {lead_id}: {e}")
            return []
        finally:
            conn.close()

    def get_document(self, document_id: str) -> dict:
        """Get a specific document"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM documents WHERE id = ?', (document_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
            
        except Exception as e:
            logger.error(f"Error getting document {document_id}: {e}")
            return None
        finally:
            conn.close()

    def update_document(self, document_id: str, update_data: dict, user_id: str) -> bool:
        """Update a document"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Prepare update data
            data = update_data.copy()
            data['updated_at'] = datetime.now().isoformat()
            
            # Sanitize data
            for key, value in data.items():
                data[key] = sanitize_value_for_sqlite(key, value)
            
            # Get table columns
            cursor.execute("PRAGMA table_info(documents)")
            table_columns = [column[1] for column in cursor.fetchall()]
            
            # Filter data
            filtered_data = {k: v for k, v in data.items() if k in table_columns}
            
            if not filtered_data:
                return False
            
            # Build UPDATE query
            set_clauses = [f'{key} = ?' for key in filtered_data.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(filtered_data.values()) + [document_id]
            
            query = f'UPDATE documents SET {set_clause} WHERE id = ?'
            cursor.execute(query, values)
            
            success = cursor.rowcount > 0
            if success:
                conn.commit()
            else:
                conn.rollback()
            
            return success
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating document {document_id}: {e}")
            return False
        finally:
            conn.close()

    def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete a document"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM documents WHERE id = ?', (document_id,))
            success = cursor.rowcount > 0
            
            if success:
                conn.commit()
            else:
                conn.rollback()
            
            return success
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting document {document_id}: {e}")
            return False
        finally:
            conn.close()

    # ========= Lead Reassignment Methods =========
    
    def create_reassignment_request(self, lead_id: str, reassignment_data: dict) -> bool:
        """Create a reassignment request for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            current_time = datetime.now().isoformat()
            
            # Update the lead with pending reassignment
            lead_update = {
                'pending_reassignment': True,
                'reassignment_status': 'requested',
                'reassignment_requested_by': reassignment_data.get('requested_by'),
                'reassignment_requested_by_name': reassignment_data.get('requested_by_name'),
                'reassignment_requested_at': current_time,
                'reassignment_target_user': reassignment_data.get('target_user_id'),
                'reassignment_target_user_name': reassignment_data.get('target_user_name'),
                'reassignment_reason': reassignment_data.get('reason'),
                'reassignment_new_data_code': reassignment_data.get('new_data_code'),
                'reassignment_new_campaign_name': reassignment_data.get('new_campaign_name'),
                'updated_at': current_time
            }
            
            # Build update query for leads table
            set_clauses = [f'{key} = ?' for key in lead_update.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(lead_update.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ? AND is_deleted = 0'
            cursor.execute(query, values)
            
            if cursor.rowcount == 0:
                return False
            
            # Create reassignment request record
            request_data = {
                'id': str(uuid.uuid4()),
                'lead_id': lead_id,
                'requested_by': reassignment_data.get('requested_by'),
                'requested_by_name': reassignment_data.get('requested_by_name'),
                'target_user_id': reassignment_data.get('target_user_id'),
                'target_user_name': reassignment_data.get('target_user_name'),
                'reason': reassignment_data.get('reason'),
                'new_data_code': reassignment_data.get('new_data_code'),
                'new_campaign_name': reassignment_data.get('new_campaign_name'),
                'status': 'pending',
                'requested_at': current_time,
                'metadata': json.dumps(reassignment_data.get('metadata', {}))
            }
            
            # Insert reassignment request
            columns = list(request_data.keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join(columns)
            
            query = f'INSERT INTO lead_reassignment_requests ({column_names}) VALUES ({placeholders})'
            cursor.execute(query, list(request_data.values()))
            
            # Log activity
            self._log_activity(cursor, lead_id, 'reassignment_requested', 
                             f"Reassignment requested to {reassignment_data.get('target_user_name', 'user')}", 
                             reassignment_data.get('requested_by'), reassignment_data.get('requested_by_name'))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating reassignment request for lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def approve_reassignment_request(self, lead_id: str, approval_data: dict) -> bool:
        """Approve a reassignment request and transfer the lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            current_time = datetime.now().isoformat()
            
            # Get current lead data
            cursor.execute('SELECT assigned_to, reassignment_target_user, reassignment_new_data_code, reassignment_new_campaign_name FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            
            if not row:
                return False
            
            old_assigned_to, target_user, new_data_code, new_campaign_name = row
            
            # Update lead with approval
            lead_update = {
                'pending_reassignment': False,
                'reassignment_status': 'approved',
                'reassignment_approved_by': approval_data.get('approved_by'),
                'reassignment_approved_by_name': approval_data.get('approved_by_name'),
                'reassignment_approved_at': current_time,
                'assigned_to': target_user,  # Actually reassign the lead
                'updated_at': current_time
            }
            
            # Update data_code and campaign_name if specified in the request
            if new_data_code is not None:
                lead_update['data_code'] = new_data_code
            if new_campaign_name is not None:
                lead_update['campaign_name'] = new_campaign_name
            
            # Track field changes for audit
            field_changes = []
            if old_assigned_to != target_user:
                field_changes.append({
                    'field_name': 'assigned_to',
                    'old_value': old_assigned_to or '',
                    'new_value': target_user or '',
                    'changed_by': approval_data.get('approved_by'),
                    'reason': 'Reassignment approved'
                })
            
            # Build update query
            set_clauses = [f'{key} = ?' for key in lead_update.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(lead_update.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ? AND is_deleted = 0'
            cursor.execute(query, values)
            
            # Update reassignment request status
            cursor.execute('''
                UPDATE lead_reassignment_requests 
                SET status = 'approved', processed_by = ?, processed_by_name = ?, processed_at = ?, processing_notes = ?
                WHERE lead_id = ? AND status = 'pending'
            ''', (
                approval_data.get('approved_by'),
                approval_data.get('approved_by_name'),
                current_time,
                approval_data.get('notes', ''),
                lead_id
            ))
            
            # Log field changes
            for change in field_changes:
                self._log_field_change(cursor, lead_id, change)
            
            # Log activity
            self._log_activity(cursor, lead_id, 'reassignment_approved', 
                             f"Reassignment approved and assigned to {approval_data.get('approved_by_name', 'user')}", 
                             approval_data.get('approved_by'), approval_data.get('approved_by_name'))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error approving reassignment for lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def reject_reassignment_request(self, lead_id: str, rejection_data: dict) -> bool:
        """Reject a reassignment request"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            current_time = datetime.now().isoformat()
            
            # Update lead with rejection
            lead_update = {
                'pending_reassignment': False,
                'reassignment_status': 'rejected',
                'reassignment_rejected_by': rejection_data.get('rejected_by'),
                'reassignment_rejected_by_name': rejection_data.get('rejected_by_name'),
                'reassignment_rejected_at': current_time,
                'reassignment_rejection_reason': rejection_data.get('reason'),
                'updated_at': current_time
            }
            
            # Build update query
            set_clauses = [f'{key} = ?' for key in lead_update.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(lead_update.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ? AND is_deleted = 0'
            cursor.execute(query, values)
            
            # Update reassignment request status
            cursor.execute('''
                UPDATE lead_reassignment_requests 
                SET status = 'rejected', processed_by = ?, processed_by_name = ?, processed_at = ?, processing_notes = ?
                WHERE lead_id = ? AND status = 'pending'
            ''', (
                rejection_data.get('rejected_by'),
                rejection_data.get('rejected_by_name'),
                current_time,
                rejection_data.get('reason', ''),
                lead_id
            ))
            
            # Log activity
            self._log_activity(cursor, lead_id, 'reassignment_rejected', 
                             f"Reassignment rejected: {rejection_data.get('reason', 'No reason provided')}", 
                             rejection_data.get('rejected_by'), rejection_data.get('rejected_by_name'))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error rejecting reassignment for lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def update_lead_reassignment_status(self, lead_id: str, update_data: dict) -> bool:
        """Update lead with reassignment related data (matching MongoDB interface)"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            current_time = datetime.now().isoformat()
            
            # Get current lead state for field history tracking
            cursor.execute('SELECT assigned_to, data_code, campaign_name, reassignment_status FROM leads WHERE id = ? AND is_deleted = 0', (lead_id,))
            row = cursor.fetchone()
            
            if not row:
                return False
            
            old_assigned_to, old_data_code, old_campaign_name, old_status = row
            
            # Track field changes for audit trail
            field_changes = []
            user_id = update_data.get("reassignment_approved_by") or update_data.get("reassignment_requested_by")
            
            # Track significant field changes
            tracked_fields = ["assigned_to", "data_code", "campaign_name", "reassignment_status"]
            for field in tracked_fields:
                if field in update_data:
                    old_value = locals().get(f'old_{field}') if field != 'reassignment_status' else old_status
                    new_value = update_data[field]
                    if old_value != new_value:
                        field_changes.append({
                            "field_name": field,
                            "old_value": str(old_value) if old_value is not None else "",
                            "new_value": str(new_value) if new_value is not None else "",
                            "changed_by": user_id,
                            "reason": "Reassignment process"
                        })
            
            # Prepare update data
            update_data_copy = update_data.copy()
            update_data_copy['updated_at'] = current_time
            
            # Build UPDATE query
            set_clauses = [f'{key} = ?' for key in update_data_copy.keys()]
            set_clause = ', '.join(set_clauses)
            values = list(update_data_copy.values()) + [lead_id]
            
            query = f'UPDATE leads SET {set_clause} WHERE id = ? AND is_deleted = 0'
            cursor.execute(query, values)
            
            if cursor.rowcount == 0:
                return False
            
            # Log field changes
            for change in field_changes:
                self._log_field_change(cursor, lead_id, change)
            
            # Add activity record for reassignment
            if "pending_reassignment" in update_data:
                if update_data["pending_reassignment"]:
                    self._log_activity(cursor, lead_id, 'reassignment_requested', 
                                     f"Reassignment requested to user {update_data.get('reassignment_target_user', 'unknown')}", 
                                     update_data.get("reassignment_requested_by"))
                else:
                    self._log_activity(cursor, lead_id, 'reassignment_processed', 
                                     f"Reassignment processed with status: {update_data.get('reassignment_status', 'unknown')}", 
                                     update_data.get("reassignment_approved_by"))
            elif update_data.get("reassignment_status") == "approved":
                # Direct reassignment case
                self._log_activity(cursor, lead_id, 'reassignment_approved_direct', 
                                 f"Direct reassignment approved to user {update_data.get('assigned_to', 'unknown')}", 
                                 update_data.get("reassignment_approved_by"))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating lead reassignment status for lead {lead_id}: {e}")
            return False
        finally:
            conn.close()

    def get_pending_reassignments(self, skip: int = 0, limit: int = 20, 
                                sort_by: str = "reassignment_requested_at", 
                                sort_order: int = -1) -> List[dict]:
        """Get leads with pending reassignment requests"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Convert sort order to SQL
            order_direction = "DESC" if sort_order == -1 else "ASC"
            
            # Build query
            query = f"""
                SELECT * FROM leads 
                WHERE pending_reassignment = 1 AND is_deleted = 0
                ORDER BY {sort_by} {order_direction}
                LIMIT ? OFFSET ?
            """
            
            cursor.execute(query, (limit, skip))
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error fetching pending reassignments: {e}")
            return []
        finally:
            conn.close()

    def count_pending_reassignments(self) -> int:
        """Count leads with pending reassignment requests"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT COUNT(*) FROM leads WHERE pending_reassignment = 1 AND is_deleted = 0')
            return cursor.fetchone()[0]
            
        except Exception as e:
            logger.error(f"Error counting pending reassignments: {e}")
            return 0
        finally:
            conn.close()

    def get_reassignment_requests(self, filters: dict = None, skip: int = 0, limit: int = 20) -> List[dict]:
        """Get reassignment requests with optional filtering"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            where_clauses = []
            params = []
            
            if filters:
                if filters.get('status'):
                    where_clauses.append('r.status = ?')
                    params.append(filters['status'])
                    
                if filters.get('requested_by'):
                    where_clauses.append('r.requested_by = ?')
                    params.append(filters['requested_by'])
                    
                if filters.get('target_user_id'):
                    where_clauses.append('r.target_user_id = ?')
                    params.append(filters['target_user_id'])
            
            where_clause = ' AND '.join(where_clauses) if where_clauses else '1=1'
            
            query = f"""
                SELECT r.*, l.first_name, l.last_name, l.email, l.phone, l.status as lead_status
                FROM lead_reassignment_requests r
                JOIN leads l ON r.lead_id = l.id
                WHERE {where_clause}
                ORDER BY r.requested_at DESC
                LIMIT ? OFFSET ?
            """
            
            params.extend([limit, skip])
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error fetching reassignment requests: {e}")
            return []
        finally:
            conn.close()

    def get_reassignment_history(self, lead_id: str) -> List[dict]:
        """Get reassignment history for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT * FROM lead_reassignment_requests 
                WHERE lead_id = ? 
                ORDER BY requested_at DESC
            """
            
            cursor.execute(query, (lead_id,))
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error fetching reassignment history for lead {lead_id}: {e}")
            return []
        finally:
            conn.close()

    def _log_field_change(self, cursor, lead_id: str, change_data: dict):
        """Log field change to history table"""
        change_record = {
            'id': str(uuid.uuid4()),
            'lead_id': lead_id,
            'field_name': change_data['field_name'],
            'old_value': change_data['old_value'],
            'new_value': change_data['new_value'],
            'changed_by': change_data['changed_by'],
            'changed_by_name': change_data.get('changed_by_name', ''),
            'changed_at': datetime.now().isoformat(),
            'reason': change_data.get('reason', ''),
            'metadata': json.dumps(change_data.get('metadata', {}))
        }
        
        columns = list(change_record.keys())
        placeholders = ', '.join(['?' for _ in columns])
        column_names = ', '.join(columns)
        
        query = f'INSERT INTO lead_field_history ({column_names}) VALUES ({placeholders})'
        cursor.execute(query, list(change_record.values()))

    def get_field_history(self, lead_id: str) -> List[dict]:
        """Get field change history for a lead"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT * FROM lead_field_history 
                WHERE lead_id = ? 
                ORDER BY changed_at DESC
            """
            
            cursor.execute(query, (lead_id,))
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error fetching field history for lead {lead_id}: {e}")
            return []
        finally:
            conn.close()

    def check_reassignment_eligibility(self, lead_id: str) -> dict:
        """Check if a lead is eligible for reassignment based on status and creation date"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Get lead and status information
            cursor.execute('''
                SELECT l.status, l.sub_status, l.created_at, l.assigned_to, 
                       s.allows_reassignment, s.description as status_description
                FROM leads l
                LEFT JOIN lead_statuses s ON l.status = s.name
                WHERE l.id = ? AND l.is_deleted = 0
            ''', (lead_id,))
            
            row = cursor.fetchone()
            
            if not row:
                return {"can_reassign": False, "reason": "Lead not found"}
            
            status, sub_status, created_at, assigned_to, allows_reassignment, status_description = row
            
            # Check if status allows reassignment
            if allows_reassignment is False:
                return {
                    "can_reassign": False, 
                    "reason": f"Status '{status}' does not allow reassignment",
                    "status_description": status_description
                }
            
            # Parse created_at
            try:
                created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                days_old = (datetime.now() - created_date).days
            except:
                days_old = 0
            
            # Enhanced eligibility rules
            if not assigned_to:
                return {"can_reassign": True, "reason": "Lead is not assigned to anyone"}
            elif days_old > 7:  # Configurable reassignment period
                return {
                    "can_reassign": True, 
                    "reason": f"Lead is {days_old} days old (> 7 day threshold)",
                    "days_old": days_old
                }
            elif status in ['NEW LEAD', 'FRESH LEAD', 'PENDING']:
                return {"can_reassign": True, "reason": "Lead status allows reassignment"}
            else:
                return {
                    "can_reassign": False, 
                    "reason": f"Lead is in active processing (status: {status}) and is only {days_old} days old",
                    "days_old": days_old,
                    "days_remaining": 7 - days_old
                }
                
        except Exception as e:
            logger.error(f"Error checking reassignment eligibility for lead {lead_id}: {e}")
            return {"can_reassign": False, "reason": "Error checking eligibility"}
        finally:
            conn.close()

    def list_leads_with_reassignment_filter(self, filter_dict: dict = None, skip: int = 0, 
                                          limit: int = 20, sort_by: str = "created_at", 
                                          sort_order: int = -1) -> List[dict]:
        """List leads with support for reassignment filtering (matching MongoDB interface)"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            where_clauses = ['l.is_deleted = 0']
            params = []
            
            if filter_dict:
                # Handle pending_reassignment filter
                if 'pending_reassignment' in filter_dict:
                    where_clauses.append('l.pending_reassignment = ?')
                    params.append(1 if filter_dict['pending_reassignment'] else 0)
                
                # Handle reassignment_status filter
                if 'reassignment_status' in filter_dict:
                    where_clauses.append('l.reassignment_status = ?')
                    params.append(filter_dict['reassignment_status'])
                
                # Handle reassignment_requested_by filter
                if 'reassignment_requested_by' in filter_dict:
                    if isinstance(filter_dict['reassignment_requested_by'], dict):
                        # Handle $in operator
                        if '$in' in filter_dict['reassignment_requested_by']:
                            users = filter_dict['reassignment_requested_by']['$in']
                            placeholders = ', '.join(['?' for _ in users])
                            where_clauses.append(f'l.reassignment_requested_by IN ({placeholders})')
                            params.extend(users)
                    else:
                        where_clauses.append('l.reassignment_requested_by = ?')
                        params.append(filter_dict['reassignment_requested_by'])
                
                # Handle $or operator for reassignment queries
                if '$or' in filter_dict:
                    or_conditions = []
                    for or_condition in filter_dict['$or']:
                        if 'pending_reassignment' in or_condition:
                            or_conditions.append('l.pending_reassignment = 1')
                        if 'reassignment_requested_by' in or_condition and '$exists' in or_condition['reassignment_requested_by']:
                            or_conditions.append('l.reassignment_requested_by IS NOT NULL')
                    
                    if or_conditions:
                        where_clauses.append(f"({' OR '.join(or_conditions)})")
                
                # Handle other standard filters
                standard_filters = ['assigned_to', 'department_id', 'status', 'created_by']
                for field in standard_filters:
                    if field in filter_dict:
                        where_clauses.append(f'l.{field} = ?')
                        params.append(filter_dict[field])
            
            where_clause = ' AND '.join(where_clauses)
            
            # Convert sort order to SQL
            order_direction = "DESC" if sort_order == -1 else "ASC"
            
            query = f"""
                SELECT l.* FROM leads l
                WHERE {where_clause}
                ORDER BY l.{sort_by} {order_direction}
                LIMIT ? OFFSET ?
            """
            
            params.extend([limit, skip])
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error listing leads with reassignment filter: {e}")
            return []
        finally:
            conn.close()

    def count_leads_with_reassignment_filter(self, filter_dict: dict = None) -> int:
        """Count leads with reassignment filtering support"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            where_clauses = ['is_deleted = 0']
            params = []
            
            if filter_dict:
                # Handle pending_reassignment filter
                if 'pending_reassignment' in filter_dict:
                    where_clauses.append('pending_reassignment = ?')
                    params.append(1 if filter_dict['pending_reassignment'] else 0)
                
                # Handle reassignment_status filter
                if 'reassignment_status' in filter_dict:
                    where_clauses.append('reassignment_status = ?')
                    params.append(filter_dict['reassignment_status'])
                
                # Handle reassignment_requested_by filter
                if 'reassignment_requested_by' in filter_dict:
                    if isinstance(filter_dict['reassignment_requested_by'], dict):
                        # Handle $in operator
                        if '$in' in filter_dict['reassignment_requested_by']:
                            users = filter_dict['reassignment_requested_by']['$in']
                            placeholders = ', '.join(['?' for _ in users])
                            where_clauses.append(f'reassignment_requested_by IN ({placeholders})')
                            params.extend(users)
                    else:
                        where_clauses.append('reassignment_requested_by = ?')
                        params.append(filter_dict['reassignment_requested_by'])
                
                # Handle $or operator
                if '$or' in filter_dict:
                    or_conditions = []
                    for or_condition in filter_dict['$or']:
                        if 'pending_reassignment' in or_condition:
                            or_conditions.append('pending_reassignment = 1')
                        if 'reassignment_requested_by' in or_condition and '$exists' in or_condition['reassignment_requested_by']:
                            or_conditions.append('reassignment_requested_by IS NOT NULL')
                    
                    if or_conditions:
                        where_clauses.append(f"({' OR '.join(or_conditions)})")
            
            where_clause = ' AND '.join(where_clauses)
            
            query = f'SELECT COUNT(*) FROM leads WHERE {where_clause}'
            cursor.execute(query, params)
            
            return cursor.fetchone()[0]
            
        except Exception as e:
            logger.error(f"Error counting leads with reassignment filter: {e}")
            return 0
        finally:
            conn.close()

    def execute_raw_query(self, query: str, params: tuple = None) -> List[dict]:
        """Execute a raw SQL query and return results as list of dictionaries"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"Error executing raw query: {e}")
            return []
        finally:
            conn.close()

    def execute_raw_query_single(self, query: str, params: tuple = None) -> dict:
        """Execute a raw SQL query and return a single result as dictionary"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
            
        except Exception as e:
            logger.error(f"Error executing raw query: {e}")
            return None
        finally:
            conn.close()

    def execute_raw_count_query(self, query: str, params: tuple = None) -> int:
        """Execute a raw SQL count query and return the count"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            return cursor.fetchone()[0]
            
        except Exception as e:
            logger.error(f"Error executing raw count query: {e}")
            return 0
        finally:
            conn.close()
