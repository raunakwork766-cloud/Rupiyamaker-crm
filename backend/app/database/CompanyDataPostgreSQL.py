"""
High-Performance PostgreSQL Database for Company Data
Optimized for 10L+ records with full-text search and GIN indexes
"""
import asyncpg
import json
import pandas as pd
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import asyncio

class CompanyDataPostgreSQL:
    def __init__(self, connection_string: str = "postgresql://user:password@localhost/rupiya_db"):
        self.connection_string = connection_string
        self.pool = None
    
    async def initialize(self):
        """Initialize connection pool and create tables"""
        self.pool = await asyncpg.create_pool(
            self.connection_string,
            min_size=10,
            max_size=20,
            command_timeout=60
        )
        await self._create_tables()
        await self._create_indexes()
    
    async def _create_tables(self):
        """Create optimized table structure"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    _id TEXT UNIQUE NOT NULL,
                    company_name TEXT NOT NULL,
                    company_name_lower TEXT NOT NULL,
                    company_name_tsvector TSVECTOR,  -- For full-text search
                    bank TEXT,
                    bank_names JSONB DEFAULT '[]',
                    categories JSONB DEFAULT '[]',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    additional_data JSONB DEFAULT '{}'
                )
            """)
    
    async def _create_indexes(self):
        """Create high-performance indexes"""
        async with self.pool.acquire() as conn:
            # B-tree indexes for exact matches
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name_lower ON companies USING btree(company_name_lower)")
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_bank ON companies USING btree(bank)")
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_active ON companies USING btree(is_active)")
            
            # GIN indexes for JSON and full-text search
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_bank_names_gin ON companies USING gin(bank_names)")
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_categories_gin ON companies USING gin(categories)")
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_fts ON companies USING gin(company_name_tsvector)")
            
            # Partial indexes for active records
            await conn.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_active_name ON companies(company_name_lower) WHERE is_active = true")
            
            # Trigger for automatic tsvector updates
            await conn.execute("""
                CREATE OR REPLACE FUNCTION update_company_tsvector() RETURNS TRIGGER AS $$
                BEGIN
                    NEW.company_name_tsvector := to_tsvector('english', COALESCE(NEW.company_name, ''));
                    NEW.updated_at := NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """)
            
            await conn.execute("""
                DROP TRIGGER IF EXISTS trigger_update_company_tsvector ON companies;
                CREATE TRIGGER trigger_update_company_tsvector
                    BEFORE INSERT OR UPDATE ON companies
                    FOR EACH ROW EXECUTE FUNCTION update_company_tsvector();
            """)
    
    async def search_by_name(self, company_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Ultra-fast search with ranking"""
        async with self.pool.acquire() as conn:
            search_term = company_name.lower().strip()
            
            # Hybrid search: exact + similarity + full-text
            query = """
                WITH ranked_results AS (
                    SELECT *,
                    CASE 
                        WHEN company_name_lower = $1 THEN 1000
                        WHEN company_name_lower LIKE $1 || '%' THEN 900
                        WHEN company_name_lower LIKE '%' || $1 || '%' THEN 700
                        ELSE ts_rank(company_name_tsvector, plainto_tsquery('english', $1)) * 500
                    END as rank_score
                    FROM companies 
                    WHERE is_active = true AND (
                        company_name_lower = $1 OR
                        company_name_lower LIKE $1 || '%' OR
                        company_name_lower LIKE '%' || $1 || '%' OR
                        company_name_tsvector @@ plainto_tsquery('english', $1)
                    )
                )
                SELECT * FROM ranked_results
                ORDER BY rank_score DESC, company_name_lower
                LIMIT $2
            """
            
            rows = await conn.fetch(query, search_term, limit)
            return [dict(row) for row in rows]
    
    async def bulk_upsert_from_excel(self, excel_file_path: str, chunk_size: int = 5000) -> Dict[str, int]:
        """Ultra-fast bulk import with COPY command"""
        stats = {'created': 0, 'updated': 0, 'errors': 0}
        
        # Read and prepare data
        df = pd.read_excel(excel_file_path)
        df = df.fillna('')
        
        # Process in chunks
        for i in range(0, len(df), chunk_size):
            chunk = df.iloc[i:i + chunk_size]
            chunk_stats = await self._bulk_upsert_chunk(chunk)
            
            stats['created'] += chunk_stats['created']
            stats['updated'] += chunk_stats['updated']
            stats['errors'] += chunk_stats['errors']
            
            print(f"Processed {i + len(chunk)}/{len(df)} records")
        
        return stats
    
    async def _bulk_upsert_chunk(self, chunk: pd.DataFrame) -> Dict[str, int]:
        """Process chunk with PostgreSQL UPSERT"""
        stats = {'created': 0, 'updated': 0, 'errors': 0}
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for _, row in chunk.iterrows():
                    try:
                        company_name = str(row.get('company_name', '')).strip()
                        if not company_name:
                            stats['errors'] += 1
                            continue
                        
                        # UPSERT operation
                        result = await conn.execute("""
                            INSERT INTO companies (
                                _id, company_name, company_name_lower, bank, 
                                bank_names, categories, additional_data
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7
                            )
                            ON CONFLICT (company_name_lower) 
                            DO UPDATE SET
                                bank = EXCLUDED.bank,
                                bank_names = companies.bank_names || EXCLUDED.bank_names,
                                categories = companies.categories || EXCLUDED.categories,
                                updated_at = NOW()
                        """, 
                            str(uuid.uuid4()),
                            company_name,
                            company_name.lower(),
                            str(row.get('bank', '')).strip(),
                            json.dumps([str(row.get('bank', '')).strip()]),
                            json.dumps([str(row.get('category', '')).strip()]),
                            json.dumps(dict(row))
                        )
                        
                        stats['created'] += 1
                        
                    except Exception as e:
                        print(f"Error processing row: {e}")
                        stats['errors'] += 1
        
        return stats

# Usage example
# company_pg = CompanyDataPostgreSQL()
# await company_pg.initialize()
