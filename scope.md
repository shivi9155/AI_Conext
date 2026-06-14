# SCOPE.md

## Project: Splitwise Expense Sharing System

### Objective

The objective of this project is to process expense transaction data, identify data quality issues, clean the dataset, and design a database schema suitable for a Splitwise-like application where users can create groups, add expenses, and track balances.

---

# 1. Data Anomaly Log

## Issue 1: Missing User Names

### Problem

Some transactions contained missing payer or participant names.

### Handling

* Records with missing user identifiers were flagged.
* If a unique user ID was available, the name was reconstructed from other records.
* Otherwise, the record was marked for manual review.

---

## Issue 2: Duplicate Expense Records

### Problem

Multiple rows represented the same expense transaction.

### Handling

Duplicates were identified using:

* Expense Date
* Amount
* Payer
* Group ID

Exact duplicates were removed.

---

## Issue 3: Invalid Amount Values

### Problem

Some expenses had:

* Negative amounts
* Zero values
* Non-numeric values

### Handling

* Negative amounts were rejected.
* Zero-value expenses were excluded.
* Invalid numeric values were converted where possible or removed.

---

## Issue 4: Missing Dates

### Problem

Several transactions had empty or invalid dates.

### Handling

* Standardized all dates to YYYY-MM-DD format.
* Invalid dates were flagged.
* Missing dates were assigned NULL and marked for review.

---

## Issue 5: Inconsistent User Names

### Problem

Users appeared under different spellings.

Examples:

* Shivani
* Shivani Sharma
* SHIVANI

### Handling

Names were normalized:

* Trimmed spaces
* Converted to title case
* Mapped known aliases to a single user record

---

## Issue 6: Currency Formatting Issues

### Problem

Amounts appeared in multiple formats.

Examples:

* ₹500
* 500 INR
* 500.00

### Handling

All values were converted to decimal format and stored as INR.

---

## Issue 7: Missing Group Information

### Problem

Some expenses did not contain a valid group identifier.

### Handling

Such expenses were assigned to a default "Personal Expenses" group or flagged for review.

---

# 2. Data Cleaning Summary

Performed:

* Duplicate removal
* Null value handling
* Data type validation
* User normalization
* Currency standardization
* Date format normalization

Result:
Clean dataset ready for relational database import.

---

# 3. Database Schema

## Users Table

| Column     | Type         |
| ---------- | ------------ |
| user_id    | INT (PK)     |
| name       | VARCHAR(100) |
| email      | VARCHAR(255) |
| created_at | TIMESTAMP    |

---

## Groups Table

| Column     | Type           |
| ---------- | -------------- |
| group_id   | INT (PK)       |
| group_name | VARCHAR(100)   |
| created_by | INT (FK Users) |
| created_at | TIMESTAMP      |

---

## Group_Members Table

| Column        | Type            |
| ------------- | --------------- |
| membership_id | INT (PK)        |
| group_id      | INT (FK Groups) |
| user_id       | INT (FK Users)  |

---

## Expenses Table

| Column       | Type            |
| ------------ | --------------- |
| expense_id   | INT (PK)        |
| group_id     | INT (FK Groups) |
| paid_by      | INT (FK Users)  |
| amount       | DECIMAL(10,2)   |
| description  | TEXT            |
| expense_date | DATE            |

---

## Expense_Shares Table

| Column       | Type              |
| ------------ | ----------------- |
| share_id     | INT (PK)          |
| expense_id   | INT (FK Expenses) |
| user_id      | INT (FK Users)    |
| share_amount | DECIMAL(10,2)     |

---

## Settlements Table

| Column          | Type           |
| --------------- | -------------- |
| settlement_id   | INT (PK)       |
| payer_id        | INT (FK Users) |
| receiver_id     | INT (FK Users) |
| amount          | DECIMAL(10,2)  |
| settlement_date | DATE           |

---

# 4. Assumptions

1. Every expense has exactly one payer.
2. An expense can be split among multiple participants.
3. All transactions are maintained in INR.
4. Users can belong to multiple groups.
5. Balances are calculated dynamically from expenses and settlements.
6. Duplicate transactions are considered accidental entries and removed.
7. Missing critical fields are flagged for manual review.

---

# Deliverables

* Cleaned CSV dataset
* Anomaly Log (this document)
* Relational Database Schema
* Import-ready data for Splitwise application
