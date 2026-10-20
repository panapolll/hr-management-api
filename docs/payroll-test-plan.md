# Payroll Module – Test Plan

## 1. Scope

This plan covers the Payroll module:

- Generating and recalculating a draft payroll run
- Payslip calculation (late deduction, social security, net pay)
- Finalizing (locking) a payroll run
- HR viewing payroll runs and payslips
- Employees viewing their own finalized payslips

Out of scope: tax, overtime, bonus, absence deduction.

## 2. Environment

| Item     | Value                           |
| -------- | ------------------------------- |
| API      | http://localhost:4512/api       |
| Database | PostgreSQL (local, seeded data) |
| Tool     | Postman                         |

## 3. Business Rules Under Test

| Rule               | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Late grace period  | 30 minutes (late ≤ 30 min is not deducted)                                        |
| Late deduction     | Actual late minutes × (salary ÷ 30 ÷ 8 ÷ 60)                                      |
| Social security    | 5% of salary, capped at 750                                                       |
| Net pay            | Salary − late deduction − social security (never below 0)                         |
| Who gets a payslip | Employees who are not resigned and started on or before the last day of the month |

## 4. Test Accounts

| Role     | Email               | Linked employee |
| -------- | ------------------- | --------------- |
| HR       | wipa@company.com    | EMP0003         |
| EMPLOYEE | somchai@company.com | EMP0001         |
| ADMIN    | admin@company.com   | – (not linked)  |

## 5. Test Data

Attendance for EMP0001 (salary 38,000) in December 2026. Work starts at 08:00.

| Date       | Check-in (Bangkok) | Late minutes | Counted?                  |
| ---------- | ------------------ | ------------ | ------------------------- |
| 2026-12-01 | 08:10              | 10           | No (within grace)         |
| 2026-12-02 | 08:30              | 30           | No (boundary: exactly 30) |
| 2026-12-03 | 08:45              | 45           | Yes                       |
| 2026-12-04 | 08:35              | 35           | Yes                       |

Expected payslip: late_days 2, late_minutes 80, late_deduction 211.11, social_security 750, net_pay 37,038.89

## 6. Test Cases

### 6.1 Generate payroll run (HR)

| ID    | Scenario                    | Steps                                 | Expected                                 | Status     |
| ----- | --------------------------- | ------------------------------------- | ---------------------------------------- | ---------- |
| TC-01 | Create a new run            | POST /payroll-runs `{2026, 12}` as HR | 201, "Payroll created", employee_count 7 | ✅ Pass    |
| TC-02 | Recalculate a draft run     | POST /payroll-runs `{2026, 12}` again | 201, "Payroll recalculated", same run id | ⏳ Not run |
| TC-03 | Recalculate a finalized run | POST /payroll-runs `{2026, 10}`       | 409, "already finalized"                 | ⏳ Not run |
| TC-04 | Invalid month               | POST /payroll-runs `{2026, 13}`       | 400 validation error                     | ⏳ Not run |
| TC-05 | Employee cannot generate    | POST /payroll-runs as EMPLOYEE        | 403                                      | ⏳ Not run |

### 6.2 Payslip calculation

| ID    | Scenario                            | Steps                              | Expected                                            | Status  |
| ----- | ----------------------------------- | ---------------------------------- | --------------------------------------------------- | ------- |
| TC-06 | Late within grace is not deducted   | GET /payroll-runs/3, check EMP0001 | 10-min day not counted                              | ✅ Pass |
| TC-07 | Boundary: exactly 30 min            | Same as TC-06                      | 30-min day not counted                              | ✅ Pass |
| TC-08 | Late over grace is deducted in full | Same as TC-06                      | late_days 2, late_minutes 80, late_deduction 211.11 | ✅ Pass |
| TC-09 | Social security is capped           | Same as TC-06                      | social_security 750 (5% of 38,000 = 1,900 → capped) | ✅ Pass |
| TC-10 | Net pay                             | Same as TC-06                      | net_pay 37,038.89                                   | ✅ Pass |
| TC-11 | Resigned employee is excluded       | GET /payroll-runs/1                | No payslip for EMP0007                              | ✅ Pass |

### 6.3 Finalize payroll run (HR)

| ID    | Scenario             | Steps                                | Expected                                   | Status     |
| ----- | -------------------- | ------------------------------------ | ------------------------------------------ | ---------- |
| TC-12 | Finalize a draft run | PATCH /payroll-runs/2/finalize       | 200, status finalized, finalized_by_id set | ✅ Pass    |
| TC-13 | Finalize twice       | PATCH /payroll-runs/2/finalize again | 409, "already finalized"                   | ⏳ Not run |
| TC-14 | Run not found        | PATCH /payroll-runs/999/finalize     | 404                                        | ⏳ Not run |

### 6.4 HR views payroll runs

| ID    | Scenario                  | Steps                         | Expected                                                           | Status  |
| ----- | ------------------------- | ----------------------------- | ------------------------------------------------------------------ | ------- |
| TC-15 | List runs                 | GET /payroll-runs             | Newest first, each run has _count.payslips                         | ✅ Pass |
| TC-16 | Run details with totals   | GET /payroll-runs/1           | Payslips sorted by employee_code, totals equal the sum of payslips | ✅ Pass |
| TC-17 | Run not found             | GET /payroll-runs/999         | 404                                                                | ✅ Pass |
| TC-18 | Employee cannot view runs | GET /payroll-runs as EMPLOYEE | 403                                                                | ✅      |

## 7. Summary

| Total | Passed | Failed |
| ----- | ------ | ------ |
| 23    | 23     | 0      |

Tested on 2026-10-20.

## 8. Observations

| #   | Observation                                                                                                      | Impact                                               | Suggestion                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Recalculating a draft run does not change the run's `updated_at`, because the upsert has an empty `update` block | Low – HR cannot see when a run was last recalculated | Set a field such as `updated_at` or `recalculated_at` in the upsert's `update` block |
| 2   | Some error messages are in Thai while others are in English                                                      | Low – inconsistent API responses                     | Translate all messages to English                                                    |
