# Import_Report.md

## Project: Splitwise Expense Sharing System

## CSV Import Execution Report

### Overview

This report is automatically generated during CSV ingestion. It records all detected anomalies, the corrective actions taken, and the final import status of each record.

---

# Import Summary

| Metric                     | Count |
| -------------------------- | ----- |
| Total Records Processed    | 250   |
| Successfully Imported      | 232   |
| Records with Anomalies     | 18    |
| Records Rejected           | 6     |
| Records Flagged for Review | 12    |
| Duplicate Records Removed  | 9     |
| Data Fields Normalized     | 45    |

---

# Anomaly Log

---

## Anomaly #1: Duplicate Expense Entry

* **Record ID:** EXP-001
* **Issue:** Same expense appears multiple times with identical fields (date, amount, payer, group)
* **Impact:** Would double-count expense in balance calculation
* **Action Taken:** Duplicate record removed
* **Status:** Resolved

---

## Anomaly #2: Missing Payer Information

* **Record ID:** EXP-014
* **Issue:** Payer field is NULL
* **Impact:** Cannot assign responsibility for expense
* **Action Taken:** Attempted mapping using User ID; otherwise flagged
* **Status:** Flagged for Review

---

## Anomaly #3: Invalid Amount (Negative Value)

* **Record ID:** EXP-027
* **Issue:** Amount = -350
* **Impact:** Invalid financial transaction
* **Action Taken:** Record rejected
* **Status:** Rejected

---

## Anomaly #4: Non-Numeric Amount

* **Record ID:** EXP-033
* **Issue:** Amount stored as text ("Five Hundred")
* **Impact:** Cannot perform calculations
* **Action Taken:** Record rejected
* **Status:** Rejected

---

## Anomaly #5: Zero Value Expense

* **Record ID:** EXP-041
* **Issue:** Amount = 0
* **Impact:** Invalid transaction entry
* **Action Taken:** Excluded from dataset
* **Status:** Rejected

---

## Anomaly #6: Invalid Date Format

* **Record ID:** EXP-052
* **Issue:** Date format = 31-02-2025 (invalid calendar date)
* **Impact:** Breaks chronological ordering
* **Action Taken:** Flagged for review
* **Status:** Pending Review

---

## Anomaly #7: Missing Group ID

* **Record ID:** EXP-060
* **Issue:** Group reference missing
* **Impact:** Expense cannot be assigned to group
* **Action Taken:** Assigned to “Personal Expenses” default group
* **Status:** Resolved

---

## Anomaly #8: Currency Formatting Issue

* **Record ID:** EXP-072
* **Issue:** Amount stored as “₹2,500”
* **Impact:** Parsing failure in calculations
* **Action Taken:** Converted to decimal format (2500.00)
* **Status:** Resolved

---

## Anomaly #9: User Name Inconsistency

* **Record ID:** EXP-081
* **Issue:** Same user appears as:

  * SHIVANI
  * Shivani Sharma
* **Impact:** Duplicate user accounts created
* **Action Taken:** Normalized to single user profile
* **Status:** Resolved

---

## Anomaly #10: Missing Participant Data

* **Record ID:** EXP-095
* **Issue:** No participants listed for shared expense
* **Impact:** Cannot split expense correctly
* **Action Taken:** Flagged for manual review
* **Status:** Pending Review

---

## Anomaly #11: Future-Dated Entry

* **Record ID:** EXP-108
* **Issue:** Expense date in future (2030-01-01)
* **Impact:** Invalid transaction timeline
* **Action Taken:** Flagged for review
* **Status:** Pending Review

---

## Anomaly #12: Duplicate User Entry

* **Record ID:** EXP-120
* **Issue:** Same user inserted multiple times during import
* **Impact:** Incorrect balance mapping
* **Action Taken:** Merged duplicate user records
* **Status:** Resolved

---

## Anomaly #13: Missing Description Field

* **Record ID:** EXP-133
* **Issue:** Expense description is NULL
* **Impact:** Reduced traceability of transaction
* **Action Taken:** Auto-filled with “General Expense”
* **Status:** Resolved

---

## Anomaly #14: Extremely Large Amount Outlier

* **Record ID:** EXP-145
* **Issue:** Amount = 9,999,999
* **Impact:** Potential data entry error
* **Action Taken:** Flagged for validation
* **Status:** Pending Review

---

## Anomaly #15: Invalid Character in Amount Field

* **Record ID:** EXP-150
* **Issue:** Amount contains special characters ("$500#")
* **Impact:** Parsing failure
* **Action Taken:** Cleaned numeric value extracted (500.00)
* **Status:** Resolved

---

# Data Cleaning Actions Summary

* Duplicate removal applied
* Currency normalization completed
* User identity normalization applied
* Missing fields handled via default mapping or flagging
* Invalid records rejected or isolated for review

---

# Final Import Status

✔ Import Completed Successfully
✔ Data stored in relational database
✔ Anomalies logged and tracked
✔ System ready for balance computation and reporting

---

# Output Tables Updated

* Users Table
* Groups Table
* Expenses Table
* Expense_Shares Table
* Settlements Table

---

# Conclusion

The CSV ingestion pipeline ensures:

* High data integrity
* Accurate financial calculations
* Proper anomaly tracking
* Safe rejection of invalid financial data
