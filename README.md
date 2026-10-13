# HR Management API

A REST API for managing employees, departments, attendance and access control, built with **NestJS**, **Prisma** and **PostgreSQL**.

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

## Permissions

| Action                              | EMPLOYEE | MANAGER  | HR  | ADMIN |
| ----------------------------------- | :------: | :------: | :-: | :---: |
| View employees & departments        |    ✅    |    ✅    | ✅  |  ✅   |
| View salaries                       |    ❌    |    ❌    | ✅  |  ✅   |
| Create / update / resign employees  |    ❌    |    ❌    | ✅  |  ✅   |
| Manage departments & managers       |    ❌    |    ❌    | ✅  |  ✅   |
| Check in / out, view own attendance |    ✅    |    ✅    | ✅  |  ❌   |
| View others' attendance             |    ❌    | Own dept | ✅  |  ✅   |
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

## Business Rules

- Work starts at 08:00 (configurable via `WORK_START`)
- Late up to 30 minutes is not deducted (configurable via `LATE_GRACE_MINUTES`)
- One check-in per employee per day, enforced at the database level
- Only `active` employees can check in; `on_leave` can still log in and view their data; `inactive` and `resigned` cannot log in
- An employee can manage only one department, and must belong to it

## Roadmap

- [x] Departments & Employees
- [x] Authentication & role-based access
- [x] Attendance
- [ ] Leave management
- [ ] Payroll
- [ ] Overtime
- [ ] Reports & dashboard
- [ ] Swagger documentation
- [ ] Docker & CI/CD
- [ ] Deployment
