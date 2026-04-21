# API Plan

API root: `/api/v1`

## Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

## Core

- `GET /dashboard`
- `GET /classes`
- `POST /classes`
- `GET /classes/:id/students`
- `GET /students`
- `POST /students`
- `GET /students/:id`
- `PATCH /students/:id`

## Attendance

- `GET /attendance/roster?classId=&date=`
- `POST /attendance/mark`
- `GET /attendance/daily`
- `GET /attendance/students/:studentId/monthly?month=YYYY-MM`

## Fees

- `GET /fees/dashboard`
- `GET /fees/structures`
- `POST /fees/structures`
- `POST /fees/assignments`
- `POST /fees/payments`
- `GET /fees/students/:studentId/ledger`
- `GET /fees/defaulters`

## Analytics, Reports, WhatsApp

- `GET /analytics/risk-summary`
- `GET /analytics/classes`
- `GET /reports/daily-principal`
- `GET /reports/fees/pending`
- `GET /reports/risk`
- `GET /reports/classes`
- `GET /notifications`
- `POST /notifications`

All protected endpoints require `Authorization: Bearer <accessToken>`.

