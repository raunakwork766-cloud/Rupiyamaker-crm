# Requirements Document

## Introduction

यह feature **Fixar Finance (Rupiya Maker CRM)** के Interview Section में Google Form Integration लाती है।
अभी HR/Admin manually interview data enter करते हैं — पहले phone number, फिर बाकी details।
इस feature के बाद:

1. Admin एक pre-configured Google Form का link CRM में save/display कर सकेगा।
2. Google Form पर "Fixar Finance by Rupiya Maker" branding (logo + title) होगी।
3. Form submit होते ही Google Apps Script एक webhook call करेगा — CRM के public (API-key protected) backend endpoint पर।
4. Backend उस data से interview record create करेगा, जो automatically Today या Upcoming tab में दिखेगा।

---

## Glossary

- **CRM_System**: Rupiya Maker CRM — React (Vite) frontend + FastAPI backend + MongoDB
- **Interview_Section**: CRM का Interview Panel (`InterviewPanel.jsx`) जहाँ interviews manage होते हैं
- **Google_Form**: Google द्वारा provide किया गया external form tool जो interview data collect करता है
- **Webhook_Endpoint**: CRM backend का public HTTP endpoint जो Google Apps Script से form submission data receive करता है
- **Apps_Script**: Google Apps Script — Google Form के `onFormSubmit` trigger पर Webhook_Endpoint को call करने वाला automation script
- **API_Key**: एक secret token जो Webhook_Endpoint को unauthorized access से protect करता है
- **Form_Config**: CRM database में stored configuration — Google Form URL, API Key, और branding settings
- **Admin**: CRM user जिसके पास Interview settings access है
- **IST**: Indian Standard Time (UTC+5:30) — date comparison के लिए reference timezone
- **Today_Tab**: Interview Section का वह sub-tab जिसमें आज की date (IST) के interviews दिखते हैं
- **Upcoming_Tab**: Interview Section का वह sub-tab जिसमें future date के interviews दिखते हैं

---

## Requirements

### Requirement 1: Google Form Configuration Management

**User Story:** As an Admin, I want to save and manage the Google Form link in CRM Interview settings, so that the form link is always accessible and up-to-date.

#### Acceptance Criteria

1. THE CRM_System SHALL provide a settings interface within the Interview Section where Admin can save, update, and delete the Google Form URL.
2. WHEN an Admin saves or updates a Google Form URL, THE CRM_System SHALL upsert (create if absent, overwrite if present) the URL in Form_Config in MongoDB and return the saved URL in the response body.
3. WHEN an Admin retrieves Interview settings and a Google Form URL is stored in Form_Config, THE CRM_System SHALL return the currently saved URL; IF no URL is configured, THE CRM_System SHALL return `null` for the `google_form_url` field.
4. IF the provided Google Form URL does not begin with `https://docs.google.com/forms/` or exceeds 2048 characters, THEN THE CRM_System SHALL reject the request with a 422 validation error and the message "URL must be a valid Google Form link starting with https://docs.google.com/forms/".
5. THE CRM_System SHALL ensure that saving a Google Form URL and then retrieving it returns an identical URL value (round-trip property).
6. WHEN an Admin deletes the Google Form URL, THE CRM_System SHALL remove the `google_form_url` field from Form_Config, return a 200 OK with `{ "success": true }`, and subsequent retrieval SHALL return `null` for `google_form_url`.

---

### Requirement 2: API Key Management for Webhook Security

**User Story:** As an Admin, I want to generate and manage a secret API key, so that only authorized Google Form submissions can create interview records in CRM.

#### Acceptance Criteria

1. WHEN an Admin clicks "Generate API Key" in Interview settings, THE CRM_System SHALL generate a new API key and display it in the settings interface.
2. WHEN an Admin generates an API key, THE CRM_System SHALL store the key in Form_Config and return the full plaintext key exactly once in the response; on all subsequent GET settings calls, THE CRM_System SHALL return the key masked (e.g., `sk_••••••••••••abcd`) showing only the last 4 characters.
3. THE CRM_System SHALL generate API keys with a minimum entropy of 32 cryptographically random bytes, encoded as a hex or base64 string (minimum 64-character hex or 43-character base64).
4. WHEN an Admin regenerates an API key, THE CRM_System SHALL atomically replace the stored key and return the response before any subsequent webhook requests are validated, so that webhook calls using the old key receive a 401 Unauthorized response after the regenerate response is returned.
5. IF an API key is regenerated, THEN THE CRM_System SHALL display a warning notice in the settings UI: "Your previous API key has been invalidated. Update your Apps Script with the new key to restore webhook functionality."

---

### Requirement 3: Google Form Branding

**User Story:** As an Admin, I want the Google Form to show "Fixar Finance" logo and "Fixar Finance by Rupiya Maker" title, so that candidates recognize the company brand when filling the form.

#### Acceptance Criteria

1. THE Apps_Script template provided by CRM_System SHALL include a commented step-by-step instruction block to set the Google Form title to exactly "Fixar Finance by Rupiya Maker" (the `setTitle()` call or manual step referencing this exact string).
2. THE Apps_Script template SHALL include a clearly labeled placeholder variable (e.g., `var LOGO_URL = "REPLACE_WITH_FIXAR_FINANCE_LOGO_URL";`) with an inline comment instructing the Admin to replace it with the publicly accessible Fixar Finance logo image URL.
3. WHERE the Admin has applied branding by either running the Apps_Script template or manually configuring the Google Form title, THE Google_Form SHALL display "Fixar Finance by Rupiya Maker" as the form title visible to the candidate at the top of the form page.
4. IF an Admin has not yet applied branding configuration, THE CRM_System SHALL NOT treat this as an error; the form remains functional for data collection without branding.

> **Note:** Google Form branding is configured manually by Admin in Google Forms UI or via Apps Script. CRM provides the template and instructions; CRM cannot directly set Google Form visual properties.

---

### Requirement 4: Google Form Fields Mapping

**User Story:** As an Admin, I want the Google Form to collect all required interview fields, so that form submissions create complete interview records without manual data entry.

#### Acceptance Criteria

1. THE Google_Form SHALL contain clearly labeled input fields for all 9 required `InterviewCreate` fields: `candidate_name`, `mobile_number`, `gender`, `job_opening`, `interview_type`, `city`, `state`, `experience_type`, `interview_date`; each required field SHALL be marked as required in Google Form settings so the form cannot be submitted with these fields empty.
2. THE Google_Form SHALL contain optional input fields for all 15 optional fields: `alternate_number`, `qualification`, `qualification_status`, `source_portal`, `total_experience`, `old_salary`, `offer_salary`, `monthly_salary_offered`, `marital_status`, `age`, `living_arrangement`, `primary_earning_member`, `type_of_business`, `banking_experience`, `interview_time`.
3. THE Apps_Script field mapping SHALL extract each form response item by its exact question title string and assign it to the corresponding JSON key before sending to Webhook_Endpoint; the mapping SHALL cover all 24 fields (9 required + 15 optional).
4. WHEN the Apps_Script receives the form response, THE Apps_Script SHALL validate that all 9 required fields are present and non-empty in the mapped payload before invoking `UrlFetchApp.fetch()`; IF any required field maps to an empty string or `undefined`, THE Apps_Script SHALL call `Logger.log("Missing required field: <fieldName>")` for each missing field and abort the webhook call without making an HTTP request.
5. THE Apps_Script template SHALL include a field-label-to-JSON-key reference comment block listing the exact Google Form question title string and its corresponding `InterviewCreate` JSON key for all 24 fields, so Admin can verify the mapping after creating the form.

---

### Requirement 5: Public Webhook Endpoint (API-Key Protected)

**User Story:** As a developer, I want a public backend endpoint that receives Google Form submissions, so that the Apps_Script can create interviews without requiring a logged-in CRM user session.

#### Acceptance Criteria

1. THE CRM_System SHALL expose a public HTTP POST endpoint at `/api/interviews/webhook/google-form` that does not require user authentication (JWT/session cookie).
2. WHEN a POST request is received at the webhook endpoint with a valid `X-API-Key` header matching the stored API key, THE CRM_System SHALL pass the request payload to the interview creation logic.
3. IF a POST request is received at the webhook endpoint with a missing, malformed, or invalid `X-API-Key` header, THEN THE CRM_System SHALL return a 401 Unauthorized response with body `{ "detail": "Invalid or missing API key" }`. A key is considered invalid only if it does not match the currently active stored API key (e.g., because it was invalidated by regeneration or was never issued).
4. WHEN the webhook receives a valid request with all 9 required fields (`candidate_name`, `mobile_number`, `gender`, `job_opening`, `interview_type`, `city`, `state`, `experience_type`, `interview_date`), THE CRM_System SHALL create an interview record in MongoDB using the `InterviewCreate` model validation rules.
5. IF any of the 9 required fields are missing from the webhook payload, THEN THE CRM_System SHALL return a 422 Unprocessable Entity response with a body containing a `detail` array where each element identifies the field name and the violation description (e.g., `[{ "loc": ["body", "candidate_name"], "msg": "field required" }]`).
6. WHEN the webhook successfully creates an interview, THE CRM_System SHALL return a 201 Created response with body `{ "success": true, "id": "<interview_id>", "message": "Interview created successfully" }`.
7. THE CRM_System SHALL assign `user_id = "google_form_webhook"` and `created_by = "google_form_webhook"` to all interviews created via the webhook endpoint.
8. THE CRM_System SHALL rate-limit the webhook endpoint to a maximum of 60 requests per minute per source IP; WHEN the rate limit is exceeded, THE CRM_System SHALL return a 429 Too Many Requests response with body `{ "detail": "Rate limit exceeded. Try again later." }`.
9. IF the MongoDB write operation fails when creating the interview, THEN THE CRM_System SHALL return a 500 Internal Server Error response with body `{ "detail": "Failed to create interview record" }` and log the exception server-side.

---

### Requirement 6: Automatic Today / Upcoming Tab Routing

**User Story:** As an HR user, I want form-submitted interviews to automatically appear in the correct tab (Today or Upcoming), so that I don't need to manually sort or filter them.

#### Acceptance Criteria

1. WHEN an interview record is created with `interview_date` (in `YYYY-MM-DD` format) equal to the current calendar date in IST, THE CRM_System SHALL display that interview in the Today_Tab within 5 seconds of the next page load or tab refresh.
2. WHEN an interview record is created with `interview_date` (in `YYYY-MM-DD` format) strictly after the current calendar date in IST, THE CRM_System SHALL display that interview in the Upcoming_Tab within 5 seconds of the next page load or tab refresh.
3. THE CRM_System SHALL use only the calendar date component (year, month, day) of `interview_date` converted to IST (UTC+5:30) for all Today/Upcoming comparisons, ignoring time-of-day.
4. WHEN a webhook-created interview is fetched via the interviews list API, THE CRM_System SHALL return all `InterviewCreate` model fields plus `_id`, `created_by`, and `user_id` in the response — the same set of fields returned for manually-created interviews.
5. IF an interview's `interview_date` calendar date in IST is before the current IST date, THE CRM_System SHALL NOT display it in Today_Tab or Upcoming_Tab; it SHALL appear only in the relevant status tab (e.g., No-Show, Rejected, etc.).
6. WHEN the IST calendar date advances past midnight and an interview previously shown in Today_Tab now has an `interview_date` that is in the past, THE CRM_System SHALL move that interview out of Today_Tab and into the applicable status tab on the next page load or tab refresh.

---

### Requirement 7: Google Form Link Display in Interview Section UI

**User Story:** As an HR user, I want to see the Google Form link prominently in the Interview Section, so that I can quickly share it with candidates or open it directly.

#### Acceptance Criteria

1. WHEN a Google Form URL is configured in Form_Config AND the current user has at least `interview → show` permission, THE Interview_Section SHALL display a "Share Form" button in the top action bar of the Interview Panel.
2. WHEN an HR user clicks the "Share Form" button, THE Interview_Section SHALL open the Google Form URL in a new browser tab using `window.open(url, '_blank')`.
3. WHEN no Google Form URL is configured in Form_Config, THE Interview_Section SHALL NOT render the "Share Form" button.
4. IF the API call to fetch Form_Config fails (network error or non-200 response), THE Interview_Section SHALL NOT display the "Share Form" button and SHALL log the error to the browser console without showing an error to the user.
5. WHEN an HR user clicks the copy icon next to the form link, THE Interview_Section SHALL call `navigator.clipboard.writeText(url)` to copy the Google Form URL to the clipboard and display a toast notification with the text "Link copied!" that auto-dismisses after 3 seconds.

---

### Requirement 8: Google Apps Script Template Provision

**User Story:** As an Admin, I want a ready-to-use Apps Script template from CRM, so that I can quickly connect the Google Form to the CRM backend without writing code from scratch.

#### Acceptance Criteria

1. THE CRM_System SHALL provide a copyable Apps Script template within the Interview settings page that includes: the webhook URL (pre-filled with the CRM's base URL + `/api/interviews/webhook/google-form`), an `API_KEY` placeholder constant, and the complete field mapping logic for all 24 `InterviewCreate` fields.
2. THE Apps_Script template SHALL construct the HTTP request using `UrlFetchApp.fetch(WEBHOOK_URL, { method: "post", contentType: "application/json", headers: { "X-API-Key": API_KEY }, payload: JSON.stringify(payload) })`.
3. THE Apps_Script template SHALL set `Content-Type: application/json` (via `contentType` option) and `X-API-Key: <API_KEY>` (via `headers` object) in every webhook request.
4. WHEN the Apps_Script receives an HTTP response with `getResponseCode()` outside the range 200–299 from the Webhook_Endpoint, THE Apps_Script SHALL call `Logger.log("Webhook error - Status: " + response.getResponseCode() + " Body: " + response.getContentText())`.
5. THE Apps_Script template SHALL include an `onFormSubmit(e)` function annotated with a comment instructing the Admin to install it as a Form trigger via the Apps Script editor (Extensions → Apps Script → Triggers → Add Trigger → onFormSubmit).

---

### Requirement 9: Data Integrity and Duplicate Handling

**User Story:** As an HR user, I want the CRM to detect duplicate phone numbers from form submissions, so that the same candidate is not entered twice accidentally.

#### Acceptance Criteria

1. WHEN the Webhook_Endpoint receives a form submission, THE CRM_System SHALL check if the trimmed value of `mobile_number` already exists as the `mobile_number` field in any interview document in MongoDB, regardless of that interview's status.
2. IF `mobile_number` already exists, THEN THE CRM_System SHALL still create the new interview record and return a 201 response with `{ "success": true, "id": "<new_id>", "duplicate_warning": true, "existing_ids": ["<id1>", ..., "<id_n>"] }`, where `existing_ids` contains the `_id` values of the up to 10 most recent matching records sorted by `created_at` descending.
3. IF `mobile_number` after trimming is not a string consisting exclusively of digits (`[0-9]`) with length between 10 and 15 inclusive, THEN THE CRM_System SHALL return a 422 Unprocessable Entity error without creating any record.
4. WHEN form data is stored via the webhook, THE CRM_System SHALL apply `str.strip()` to all string fields defined in the `InterviewCreate` model before writing to MongoDB.
5. WHEN the CRM_System returns a 201 response with `duplicate_warning: true`, THE Interview_Section SHALL display a yellow warning indicator on the newly created interview row in the list view with the tooltip "Possible duplicate — same phone number exists".

---

### Requirement 10: Webhook Activity Logging

**User Story:** As an Admin, I want to see a log of Google Form webhook submissions, so that I can audit and troubleshoot integration issues.

#### Acceptance Criteria

1. THE CRM_System SHALL log every webhook request received at `/api/interviews/webhook/google-form` as a structured document containing: `timestamp` (IST datetime), `source_ip` (string), `http_status` (integer), and `outcome` (one of: `"created"`, `"duplicate_created"`, `"rejected_unauthorized"`, `"rejected_invalid"`); on success the `failure_reason` field SHALL be `null`; on failure it SHALL contain the error detail string from the response body.
2. IF a webhook request is rejected (results in a 401 or 422 response), THEN THE CRM_System SHALL set `failure_reason` in the log entry to the exact error detail string returned in the response body (e.g., `"Invalid or missing API key"` or the field-level validation message).
3. THE CRM_System SHALL retain webhook activity log entries for a minimum of 30 days from creation; entries older than 30 days MAY be purged by the system.
4. WHERE an Admin-accessible webhook log view is implemented in Interview settings, THE CRM_System SHALL display the 50 most recent webhook log entries in reverse chronological order by `timestamp`; IF no log entries exist, THE CRM_System SHALL display the message "No webhook activity recorded yet."
