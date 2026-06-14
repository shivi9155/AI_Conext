# AI_USAGE.md

## Project: Splitwise Expense Sharing System

## Purpose

This document explains the AI tools used during development, key prompts that guided the work, and real cases where AI-generated outputs were incorrect, how those issues were identified, and what corrections were applied.

---

# 1. AI Tools Used

### 1. ChatGPT (Primary Tool)

Used for:

* Database schema design
* CSV anomaly detection logic
* Import pipeline design
* Documentation (SCOPE, DECISIONS, IMPORT REPORT)
* System architecture suggestions

---

### 2. GitHub Copilot

Used for:

* Boilerplate backend code (Node.js / Python)
* SQL query generation
* API endpoint scaffolding
* Basic validation functions

---

### 3. Manual Review (Human Oversight)

Used for:

* Validating schema correctness
* Verifying financial logic
* Ensuring normalization rules
* Testing import pipeline outputs

---

# 2. Key Prompts Used

## Prompt 1: Database Design

"Design a normalized database schema for a Splitwise-style expense sharing system with users, groups, expenses, and settlements."

Outcome:

* Generated relational schema with proper foreign keys and many-to-many mapping.

---

## Prompt 2: CSV Anomaly Detection

"Identify common anomalies in expense-sharing CSV files and suggest how to detect and fix them during import."

Outcome:

* Produced validation rules for duplicates, missing fields, invalid amounts, and date errors.

---

## Prompt 3: Import Pipeline Design

"Create an import pipeline that reads CSV data, validates records, logs anomalies, and stores clean data into a database."

Outcome:

* Helped design structured import flow with anomaly logging.

---

## Prompt 4: Balance Calculation Logic

"Explain how to calculate user balances in a Splitwise system using expenses and settlements."

Outcome:

* Derived dynamic balance computation approach.

---

# 3. AI Error Cases and Corrections

---

## Error Case 1: Incorrect Database Normalization

### AI Output

AI suggested storing participants inside the Expenses table as:

```
participants = "1,2,3"
```

### Why It Was Wrong

* Violates 1NF (First Normal Form)
* Makes querying and updates difficult
* Breaks relational integrity

### How It Was Detected

Manual schema review revealed:

* No proper many-to-many relationship support

### Fix Applied

Created a separate table:

* `Expense_Shares (expense_id, user_id, share_amount)`

### Final Result

Proper normalized relational structure

---

## Error Case 2: Using FLOAT for Money Values

### AI Output

Suggested:

```
amount FLOAT
```

### Why It Was Wrong

* Floating point causes rounding errors in financial calculations

### How It Was Detected

Test case:

* ₹10.10 + ₹20.20 produced inaccurate results

### Fix Applied

Replaced with:

```
DECIMAL(10,2)
```

### Final Result

Accurate and reliable financial calculations

---

## Error Case 3: Auto-deleting Invalid Records

### AI Output

AI suggested removing all rows with missing values.

### Why It Was Wrong

* Risk of losing recoverable or partially valid financial data
* Violates auditability requirement

### How It Was Detected

Cross-checked assignment requirement:

* Data must be traceable, not blindly deleted

### Fix Applied

Changed strategy:

* Flag invalid records instead of deleting
* Allow manual review pipeline

### Final Result

Improved data safety and audit compliance

---

## Error Case 4: Storing Precomputed Balances

### AI Output

Suggested storing user balances directly in DB.

### Why It Was Wrong

* Balances become inconsistent after edits or deletions

### How It Was Detected

Simulation:

* Updating one expense caused incorrect stored balances

### Fix Applied

Recomputed balances dynamically from:

* Expenses
* Shares
* Settlements

### Final Result

Always accurate real-time balances

---

# 4. Verification Strategy

All AI-generated outputs were validated using:

* Schema normalization rules
* Sample CSV import tests
* Edge-case validation (negative, missing, duplicate data)
* Balance recalculation checks
* Manual inspection of query results

---

# 5. Conclusion

AI significantly accelerated development, especially in:

* Schema design
* Data validation logic
* Documentation generation

However, all outputs were critically reviewed, and incorrect assumptions were corrected before implementation. Human validation ensured correctness, financial accuracy, and adherence to relational database principles.
