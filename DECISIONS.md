# DECISIONS.md

## Project: Splitwise Expense Sharing System

### Purpose

This document records the significant design, data processing, and implementation decisions made during the development of the Splitwise-style expense management system.

---

# Decision 1: Use a Relational Database

## Options Considered

1. Relational Database (PostgreSQL/MySQL)
2. NoSQL Database (MongoDB)

## Decision

Selected a Relational Database.

## Reason

The application contains highly structured relationships:

* Users
* Groups
* Expenses
* Expense Shares
* Settlements

Foreign key constraints and joins are important for maintaining data consistency and generating balance calculations efficiently.

---

# Decision 2: Store Expense Splits in a Separate Table

## Options Considered

### Option A

Store participant information directly in the Expenses table.

### Option B

Create a dedicated Expense_Shares table.

## Decision

Created Expense_Shares table.

## Reason

A single expense can be shared by multiple users.

Example:
Expense: ₹1000

Participants:

* Shivani
* Rahul
* Aman

A separate table provides better normalization and scalability.

---

# Decision 3: Remove Exact Duplicate Records

## Options Considered

### Option A

Keep all duplicate rows.

### Option B

Remove exact duplicates.

## Decision

Removed duplicates.

## Reason

Duplicate transactions would inflate group balances and create incorrect debt calculations.

---

# Decision 4: Standardize Date Format

## Options Considered

### Option A

Store dates as provided.

### Option B

Convert all dates into a single format.

## Decision

Converted all dates to YYYY-MM-DD.

## Reason

A standardized format simplifies:

* Reporting
* Filtering
* Database queries
* Future API integration

---

# Decision 5: Normalize User Names

## Options Considered

### Option A

Treat every name variation as a different user.

### Option B

Normalize user names.

## Decision

Normalize names.

## Reason

Different spellings of the same user would create duplicate accounts and incorrect balances.

Example:

* SHIVANI
* Shivani
* Shivani Sharma

These were standardized whenever possible.

---

# Decision 6: Use Decimal Data Type for Amounts

## Options Considered

### Option A

Integer

### Option B

Float

### Option C

Decimal

## Decision

Used Decimal(10,2).

## Reason

Financial calculations require precision.
Float values may introduce rounding errors.

---

# Decision 7: One Expense Has One Payer

## Options Considered

### Option A

Multiple payers per expense.

### Option B

Single payer per expense.

## Decision

Single payer per expense.

## Reason

This matches the Splitwise model and simplifies balance computation.

Multiple contributors can create separate expense entries if needed.

---

# Decision 8: Calculate Balances Dynamically

## Options Considered

### Option A

Store balances in database.

### Option B

Compute balances from expenses and settlements.

## Decision

Compute balances dynamically.

## Reason

Dynamic calculation prevents inconsistencies and ensures balances always reflect the latest data.

---

# Decision 9: Handle Missing Values with Validation

## Options Considered

### Option A

Automatically fill missing values.

### Option B

Flag incomplete records.

## Decision

Flag incomplete records for review.

## Reason

Guessing financial data can introduce inaccuracies.
Data integrity is more important than automatic completion.

---

# Decision 10: Use Separate Settlements Table

## Options Considered

### Option A

Store settlements as expenses.

### Option B

Create a dedicated Settlements table.

## Decision

Created Settlements table.

## Reason

Settlements represent debt repayment, not spending.
Separating them improves reporting and balance tracking.

---

# Decision 11: Support Multiple Groups Per User

## Options Considered

### Option A

One user belongs to one group.

### Option B

One user can belong to multiple groups.

## Decision

Allow multiple groups.

## Reason

This reflects real-world usage.

Examples:

* Family Group
* Hostel Group
* Trip Group
* Office Team Group

---

# Decision 12: Use Soft Validation During Data Cleaning

## Options Considered

### Option A

Delete all problematic records.

### Option B

Flag and review problematic records.

## Decision

Flag records whenever possible.

## Reason

Preserves potentially valuable data while maintaining transparency about data quality issues.

---

# Summary of Key Decisions

| Area                | Decision                      |
| ------------------- | ----------------------------- |
| Database Type       | Relational Database           |
| Duplicate Handling  | Remove Exact Duplicates       |
| Date Format         | YYYY-MM-DD                    |
| Amount Storage      | Decimal(10,2)                 |
| User Management     | Normalized Users              |
| Expense Spliting    | Separate Expense_Shares Table |
| Balance Calculation | Dynamic                       |
| Settlements         | Separate Table                |
| Missing Data        | Validation & Review           |
| Group Membership    | Many-to-Many Relationship     |

---

## Final Outcome

The chosen design prioritizes:

* Data integrity
* Accurate balance calculations
* Database normalization
* Scalability
* Compatibility with Splitwise-style expense tracking systems
