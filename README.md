# HR Management API

A REST API for managing employees, departments, attendance, leave and payroll, built with **NestJS**, **Prisma** and **PostgreSQL**.

## Architecture

![Architecture](docs/architecture.png)

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Framework  | NestJS 11 (TypeScript)             |
| ORM        | Prisma 5                           |
| Database   | PostgreSQL                         |
| Auth       | JWT (passport-jwt), bcrypt         |
| Validation | class-validator, class-transformer |

## Features

**Departments**

- CRUD with unique department codes
- Assign and remove department managers
- Managers are cleared automatically when they transfer or resign

**Employees**

- CRUD with search, filters and pagination
- Soft delete (resignation changes status instead of deleting)
- Salary is visible only to HR and ADMIN, excluded at the query level

**Authentication & Authorization**

- JWT login, accounts created by HR/ADMIN only
- Role-based access control: `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`
- Roles are loaded fresh from the database on every request, so role changes take effect immediately
- Inactive and resigned employees lose access instantly, even with an unexpired token
- Users can change their own password

**Attendance**

- Check-in / check-out using server time (employees cannot submit their own timestamps)
- Late minutes calculated in Thailand time (UTC+7), independent of server timezone
- Managers see only their own department; HR and ADMIN see everyone

**Leave**

- Sick, personal and vacation leave with yearly quotas (configurable)
- Only weekdays are counted; overlapping requests are rejected
- Pending requests reserve quota, so employees cannot over-book
- Managers review their own department; HR reviews everyone; nobody can review their own request
- Approve / reject is protected against double-clicks and two reviewers acting at the same time

**Payroll**

- HR generates a monthly payroll run as a draft and can recalculate it until it is finalized
- Late deduction, social security (5%, capped at 750) and net pay calculated with `Decimal` to avoid rounding errors
- Finalizing locks the run; it cannot be recalculated or finalized twice
- Base salary is copied into each payslip, so later salary changes do not affect past payslips
- Employees see only their own payslips, and only after the run is finalized

## Permissions

| Action                              | EMPLOYEE | MANAGER  | HR  | ADMIN |
| ----------------------------------- | :------: | :------: | :-: | :---: |
| View employees & departments        |    ✅    |    ✅    | ✅  |  ✅   |
| View salaries                       |    ❌    |    ❌    | ✅  |  ✅   |
| Create / update / resign employees  |    ❌    |    ❌    | ✅  |  ✅   |
| Manage departments & managers       |    ❌    |    ❌    | ✅  |  ✅   |
| Check in / out, view own attendance |    ✅    |    ✅    | ✅  |  ❌   |
| View others' attendance             |    ❌    | Own dept | ✅  |  ✅   |
| Request / cancel own leave          |    ✅    |    ✅    | ✅  |  ❌   |
| View others' leave                  |    ❌    | Own dept | ✅  |  ✅   |
| Approve / reject leave              |    ❌    | Own dept | ✅  |  ❌   |
| Generate / finalize payroll         |    ❌    |    ❌    | ✅  |  ✅   |
| View all payslips                   |    ❌    |    ❌    | ✅  |  ✅   |
| View own finalized payslips         |    ✅    |    ✅    | ✅  |  ❌   |
| Create user accounts                |    ❌    |    ❌    | ✅  |  ✅   |
| Change user roles                   |    ❌    |    ❌    | ❌  |  ✅   |

## Getting Started

### Prerequisites

- Node.js
- Yarn
- PostgreSQL

### 1. Install

```bash
git clone https://github.com/panapolll/hr-management-api.git
cd hr-management-api
yarn install
```

### 2. Configure environment

Copy the example file:

```bash
cp .env.example .env
```

Then edit `.env` and set at least:

| Variable              | Description                              |
| --------------------- | ---------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string             |
| `JWT_SECRET`          | A long random string used to sign tokens |
| `SEED_ADMIN_PASSWORD` | Password for the demo ADMIN account      |
| `SEED_USER_PASSWORD`  | Password for the other demo accounts     |

Generate a secure `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

This creates all tables and loads sample data (departments, employees and demo accounts):

```bash
yarn prisma migrate reset
```

To load sample data again later without wiping the database:

```bash
yarn prisma db seed
```

### 4. Run

```bash
yarn start:dev
```

The API runs at `http://localhost:4512/api`

### Demo Accounts

Created by the seed script. Passwords come from `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` in `.env`.

| Email               | Role         |
| ------------------- | ------------ |
| admin@company.com   | ADMIN        |
| wipa@company.com    | HR           |
| piya@company.com    | MANAGER (IT) |
| somchai@company.com | EMPLOYEE     |

## API Endpoints

All routes are prefixed with `/api` and require a Bearer token, except `POST /auth/login`.

### Auth

| Method | Route                  | Access    |
| ------ | ---------------------- | --------- |
| POST   | `/auth/login`          | Public    |
| POST   | `/auth/register`       | HR, ADMIN |
| GET    | `/auth/me`             | All       |
| PATCH  | `/auth/me/password`    | All       |
| GET    | `/auth/users`          | ADMIN     |
| PATCH  | `/auth/users/:id/role` | ADMIN     |

### Departments

| Method | Route                      | Access    |
| ------ | -------------------------- | --------- |
| GET    | `/departments`             | All       |
| GET    | `/departments/:id`         | All       |
| POST   | `/departments`             | HR, ADMIN |
| PATCH  | `/departments/:id`         | HR, ADMIN |
| PATCH  | `/departments/:id/manager` | HR, ADMIN |
| DELETE | `/departments/:id`         | HR, ADMIN |

### Employees

| Method | Route            | Access                              |
| ------ | ---------------- | ----------------------------------- |
| GET    | `/employees`     | All (salary hidden unless HR/ADMIN) |
| GET    | `/employees/:id` | All (salary hidden unless HR/ADMIN) |
| POST   | `/employees`     | HR, ADMIN                           |
| PATCH  | `/employees/:id` | HR, ADMIN                           |
| DELETE | `/employees/:id` | HR, ADMIN (marks as resigned)       |

Query parameters for `GET /employees`: `page`, `limit`, `search`, `department_id`, `status`

### Attendance

| Method | Route                   | Access                        |
| ------ | ----------------------- | ----------------------------- |
| POST   | `/attendance/check-in`  | Employees                     |
| POST   | `/attendance/check-out` | Employees                     |
| GET    | `/attendance/me`        | Employees                     |
| GET    | `/attendance`           | MANAGER (own dept), HR, ADMIN |

Query parameters for `GET /attendance`: `from`, `to`, `department_id`, `employee_id`, `page`, `limit`

### Leave

| Method | Route                 | Access                        |
| ------ | --------------------- | ----------------------------- |
| POST   | `/leaves`             | Employees                     |
| GET    | `/leaves/me`          | Employees                     |
| GET    | `/leaves/me/balance`  | Employees                     |
| PATCH  | `/leaves/:id/cancel`  | Employees (own pending only)  |
| GET    | `/leaves`             | MANAGER (own dept), HR, ADMIN |
| PATCH  | `/leaves/:id/approve` | MANAGER (own dept), HR        |
| PATCH  | `/leaves/:id/reject`  | MANAGER (own dept), HR        |

Query parameters for `GET /leaves`: `status`, `type`, `employee_id`, `department_id`, `year`, `page`, `limit`

### Payroll

| Method | Route                        | Access    |
| ------ | ---------------------------- | --------- |
| POST   | `/payroll-runs`              | HR, ADMIN |
| GET    | `/payroll-runs`              | HR, ADMIN |
| GET    | `/payroll-runs/:id`          | HR, ADMIN |
| PATCH  | `/payroll-runs/:id/finalize` | HR, ADMIN |
| GET    | `/payslips/me`               | Employees |

## Business Rules

- Work starts at 08:00 (configurable via `WORK_START`)
- Late up to 30 minutes is not deducted (configurable via `LATE_GRACE_MINUTES`)
- One check-in per employee per day, enforced at the database level
- Only `active` employees can check in; `on_leave` can still log in and view their data; `inactive` and `resigned` cannot log in
- An employee can manage only one department, and must belong to it

**Leave**

- Yearly quotas: sick 30, personal 6, vacation 6 days (configurable via `LEAVE_QUOTA_*`)
- A request must start and end in the same year
- Only `pending` requests can be cancelled, approved or rejected; a reject requires a note

**Payroll**

- Per-minute wage = salary ÷ 30 ÷ 8 ÷ 60 (configurable via `PAYROLL_DAYS_PER_MONTH`, `PAYROLL_HOURS_PER_DAY`)
- Late within the grace period is not deducted; late beyond it is deducted for the full late minutes
- Social security = 5% of salary, capped at 750 (configurable via `SOCIAL_SECURITY_RATE`, `SOCIAL_SECURITY_MAX`)
- Net pay = salary − late deduction − social security (never below 0)
- Payslips are created for employees who are not resigned and started on or before the last day of the month
- Out of scope: tax, overtime, bonus and absence deduction

## Testing

The Payroll module was tested manually with Postman against a written test plan (23 test cases, including boundary cases such as being exactly 30 minutes late).

See [docs/payroll-test-plan.md](docs/payroll-test-plan.md).

## Roadmap

- [x] Departments & Employees
- [x] Authentication & role-based access
- [x] Attendance
- [x] Leave management
- [x] Payroll
- [ ] Overtime
- [ ] Reports & dashboard
- [ ] Swagger documentation
- [ ] Docker & CI/CD
- [ ] Deployment
