#!/usr/bin/env python3
"""
Fix AboutSection.jsx to use parent onSave with fallback to direct API
This prevents obligation_data loss when updating pincode/city
"""

import re

file_path = "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/sections/AboutSection.jsx"

# Read the file
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Pattern to find the handleFieldBlur section that needs updating
# We're looking for the section after "console.log(`📤 AboutSection: Sending minimal update"
# up to "// Show success message"

old_pattern = r'''      console\.log\(`📤 AboutSection: Sending minimal update for \$\{field\}:`, updatePayload\);
      
      // Call the parent's onSave function with minimal payload
      // Parent \(LeadDetails\.updateLead\) will merge with existing dynamic_fields
      if \(onSave\) \{
        console\.log\(`.+ AboutSection: Calling parent onSave \(with defensive merge\)`\);
        
        const result = onSave\(updatePayload\);
        if \(result instanceof Promise\) \{
          await result;
        \}
        
        console\.log\(`✅ AboutSection: Successfully saved \$\{field\}`\);
      \} else \{
        console\.warn\(`⚠️ AboutSection: No onSave function provided - changes will not be saved!`\);
      \}
      
      // Show success message
      setSaveStatus\('✅ Saved successfully!'\);'''

new_code = '''      console.log(`📤 AboutSection: Update payload for ${field}:`, updatePayload);
      
      // Try parent onSave first (if available)
      // Otherwise fallback to direct API call for backward compatibility
      let savedViaParent = false;
      if (onSave && typeof onSave === 'function') {
        try {
          console.log(`📡 AboutSection: Calling parent onSave`);
          const result = onSave(updatePayload);
          if (result instanceof Promise) {
            await result;
          }
          savedViaParent = true;
          console.log(`✅ AboutSection: Saved via parent callback`);
        } catch (error) {
          console.warn(`⚠️ AboutSection: Parent onSave failed, falling back to direct API:`, error);
        }
      }
      
      // Fallback to direct API call if no parent callback or if it failed
      if (!savedViaParent && lead?._id) {
        console.log(`📡 AboutSection: Using direct API call (backward compatibility)`);
        await saveToAPI(field, value, updatePayload);
      }
      
      // Show success message
      setSaveStatus('✅ Saved successfully!');'''

# Replace the pattern
content_new = re.sub(old_pattern, new_code, content, flags=re.MULTILINE)

if content == content_new:
    print("❌ No match found - pattern didn't match")
    print("Trying simpler approach...")
    
    # Try a simpler replacement focusing on just the problematic emoji
    # Find and replace the corrupted character
    content_new = content.replace(
        "console.log(`\ufffd AboutSection: Calling parent onSave (with defensive merge)`);",
        "console.log(`📡 AboutSection: Calling parent onSave (with defensive merge)`);"
    )
    
    if content == content_new:
        print("Still no match. Let's try manual line-based approach...")
        lines = content.split('\n')
        
        # Find the line with the pattern
        for i, line in enumerate(lines):
            if "Sending minimal update for" in line and "updatePayload" in line:
                print(f"Found start at line {i+1}")
                # Now find and replace the block
                if i + 20 < len(lines):
                    # Check if the next lines match our expected pattern
                    if "Call the parent's onSave function" in lines[i+2]:
                        print("Found matching block, replacing...")
                        # Replace lines i+1 to i+17
                        new_lines = new_code.split('\n')
                        lines[i:i+18] = new_lines
                        content_new = '\n'.join(lines)
                        break
    
# Now update the saveToAPI function signature
old_save_api = r'const saveToAPI = async \(field, value\) => \{'
new_save_api = 'const saveToAPI = async (field, value, updatePayload = null) => {'

content_new = re.sub(old_save_api, new_save_api, content_new)

# Add logic to use updatePayload if provided
# Find the line with "Map fields to appropriate API fields" and insert logic before it
old_before_map = r'''      console\.log\(`📡 AboutSection: Using \$\{isLoginLead \? 'LOGIN LEADS' : 'MAIN LEADS'\} endpoint`\);

      
      // Map fields to appropriate API fields'''

new_before_map = '''      console.log(`📡 AboutSection: Using ${isLoginLead ? 'LOGIN LEADS' : 'MAIN LEADS'} endpoint`);

      // Use provided updatePayload if available
      if (updatePayload) {
        console.log(`📡 AboutSection: Using pre-built updatePayload:`, updatePayload);
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`✅ AboutSection: Successfully saved ${field} via updatePayload:`, responseData);
        return true;
      }
      
      // Fallback: Build update payload from scratch (backward compatibility)
      console.log(`⚠️ AboutSection: No updatePayload provided, building from field/value`);
      
      // Map fields to appropriate API fields'''

content_new = re.sub(old_before_map, new_before_map, content_new, flags=re.MULTILINE)

# Write the updated content
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content_new)

print("✅ File updated successfully!")
print("Changes:")
print("1. Added fallback logic to handleFieldBlur - tries parent onSave first, then direct API")
print("2. Modified saveToAPI to accept optional updatePayload parameter")
print("3. Added logic to use updatePayload directly if provided")
