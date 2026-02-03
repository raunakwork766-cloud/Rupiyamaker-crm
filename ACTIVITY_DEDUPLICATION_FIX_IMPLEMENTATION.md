# Activity Deduplication Fix - Complete Implementation Guide

## Problem
When a user clears a field and immediately enters a new value, TWO activities are created:
1. Activity 1: "Phone: 9876543210 → empty"
2. Activity 2: "Phone: empty → 9876543219"

## Expected Result
Only ONE activity should be created:
- Activity: "Phone: 9876543210 → 9876543219"

## Solution Architecture

### 1. Add Deduplication Collection
```python
# In LeadsDB.__init__()
self.activity_updates_collection = self.db["lead_activity_updates"]
```

### 2. Create TTL Index for Auto-Cleanup
```python
# In _create_optimized_indexes()
await self.activity_updates_collection.create_index(
    [("created_at", 1)],
    expireAfterSeconds=10,  # Auto-delete after 10 seconds
    background=True
)
await self.activity_updates_collection.create_index(
    [("lead_id", 1), ("field_name", 1), ("created_at", 1)],
    background=True
)
```

### 3. Add Deduplication Method
```python
async def _deduplicate_activity(self, lead_id: str, field_name: str, 
                              old_value: Any, new_value: Any, 
                              updated_at: datetime) -> Tuple[bool, Any, Any, Optional[str]]:
    """
    Check for recent updates and consolidate.
    
    Returns:
        (should_create, final_old, final_new, delete_activity_id)
    """
    from datetime import timedelta
    cutoff_time = updated_at - timedelta(seconds=10)
    
    recent_update = await self.activity_updates_collection.find_one({
        "lead_id": lead_id,
        "field_name": field_name,
        "created_at": {"$gte": cutoff_time}
    })
    
    if recent_update:
        # Consolidate: Use original old value + current new value
        final_old_value = recent_update.get("original_old_value")
        final_new_value = new_value
        activity_id_to_delete = recent_update.get("activity_id")
        
        # Delete the tracker
        await self.activity_updates_collection.delete_one({"_id": recent_update["_id"]})
        
        # Return activity_id to delete
        return (True, final_old_value, final_new_value, activity_id_to_delete)
    else:
        # First update - store for potential consolidation
        return (True, old_value, new_value, None)
```

### 4. Add Storage Method
```python
async def _store_activity_for_deduplication(self, lead_id: str, field_name: str, 
                                       activity_id: str, old_value: Any, 
                                       updated_at: datetime):
    """Store activity reference after creation for future deduplication."""
    await self.activity_updates_collection.insert_one({
        "lead_id": lead_id,
        "field_name": field_name,
        "activity_id": activity_id,
        "original_old_value": old_value,
        "created_at": updated_at
    })
```

### 5. Update Activity Creation Logic
For each activity creation in `update_lead()`:

**Before creating activity:**
```python
should_create, final_old, final_new, delete_id = await self._deduplicate_activity(
    lead_id, field_name, old_val, new_val, update_data["updated_at"]
)

# Delete previous activity if consolidating
if delete_id:
    await self.activity_collection.delete_one({"_id": ObjectId(delete_id)})
    logger.info(f"🗑 Deleted previous activity {delete_id}")

# Skip if deduplication says no
if not should_create:
    continue

# Use consolidated values
old_val = final_old
new_val = final_new
```

**After creating activity:**
```python
# Store for potential future deduplication
await self._store_activity_for_deduplication(
    lead_id, field_name, str(result.inserted_id), 
    old_val, update_data["updated_at"]
)
```

## Test Cases

### Test Case 1: Clear and Immediately Re-enter
1. Clear "Phone" field → "9876543210 → ""
2. Activity created: ID="act_001", stored in tracker
3. Enter "9876543219" immediately → detected recent update
4. Delete activity "act_001"
5. Create ONE activity: "Phone: 9876543210 → 9876543219"

### Test Case 2: Normal Update
1. Change "Phone" → "9876543210 → 9876543219"
2. No recent update found
3. Create ONE activity: "Phone: 9876543210 → 9876543219"
4. Store in tracker

### Test Case 3: Delayed Updates
1. Change "Phone" → "9876543210 → 9876543219"
2. Store in tracker
3. Wait 15 seconds (tracker expires)
4. Change "Phone" → "9876543219 → 9123456789"
5. No recent update (tracker expired)
6. Create ONE activity: "Phone: 9876543219 → 9123456789"

## Benefits
- ✅ Eliminates duplicate activities
- ✅ Shows correct transition (old → new, not old → empty → new)
- ✅ Auto-cleanup of tracker records (10 second TTL)
- ✅ Minimal performance impact
- ✅ Works across all field types (dynamic, process_data, regular)

## Deployment Steps
1. Add collection initialization to `__init__`
2. Add indexes to `_create_optimized_indexes`
3. Add `_deduplicate_activity` method
4. Add `_store_activity_for_deduplication` method
5. Update all activity creation points in `update_lead`:
   - dynamic_fields changes
   - process_data changes
   - Regular field changes
6. Restart backend service
7. Test by clearing and immediately re-entering a field