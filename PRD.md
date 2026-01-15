<!--
This PRD is the source of truth.
If code conflicts with this document, the document wins.
-->

📄 MASTER PRD PROMPT FOR VIBE CODING AI
Role & Mindset

You are a senior full-stack engineer and systems architect building a production-ready logistics web application.
Think in terms of real-world warehouse operations, data integrity, and scalable backend architecture.
Do not oversimplify. Do not skip edge cases.

Product Name (Working Title)

Philippines Warehouse Address & Delivery Service

1. Product Overview
   Product Summary

This application provides users with a secondary warehouse address in the Philippines that they can use when ordering online. Parcels are delivered to a centralized warehouse, identified using a unique member code, recorded in the system, and later delivered to the user for a fee.

The product is a logistics and warehouse management system, not just a dashboard.

2. Core Problems Being Solved
   User Problems

Users do not want to ship items directly to their home address

Users want confirmation when parcels arrive

Users want controlled and paid delivery from a trusted warehouse

    Warehouse Problems

Need to identify parcel ownership quickly and accurately

Need to avoid manual guesswork

Need structured handling of exceptions

3. Product Principles (Non-Negotiable)

One parcel has exactly one owner

Parcel ownership is never guessed

Parcel state transitions cannot be skipped

All business logic lives in the backend

Frontend reflects backend truth only

All critical actions are auditable

4. User Roles
1. User (Customer)

Has a unique warehouse address

Views owned parcels

Requests delivery

Pays delivery fees

2. Warehouse Staff

Registers incoming parcels

Updates parcel states

Handles intake operations

Flags exceptions

3. Admin

Manages users and staff

Resolves exceptions

Overrides system behavior (with audit logs)

5. Unique Member Code System (Critical)

Each user is assigned a permanent, unique member code.

Characteristics

Alphanumeric

Non-guessable

Immutable

Never reused

Example:

PHW-7F4K92

Address Format
User Full Name
Warehouse Name
Unit PHW-7F4K92
Warehouse Street Address
City, Philippines
Phone Number

This member code is the primary identifier for parcel ownership.

6. Parcel Lifecycle (Strict State Machine)

Parcels must follow this lifecycle strictly:

Expected (optional, via pre-alert)

Arrived

Stored

Delivery Requested

Out for Delivery

Delivered

Rules

Invalid transitions are rejected

State changes are transactional

All transitions are logged

7. Core Functionalities
   User Web App

Account registration and login

View assigned warehouse address

View parcel list and status

View parcel history

Request delivery

View delivery fees

Track delivery status

Warehouse Dashboard

Register incoming parcels

Search parcels by member code

View parcels by status

Update parcel states

Flag parcels with issues

Admin Panel

User management

Warehouse staff management

Exception resolution

System-wide audit logs

8. Exception Handling (First-Class Feature)
   Exception Triggers

Missing member code

Invalid member code

Illegible or damaged label

Damaged parcel

Duplicate tracking numbers

Conflicting ownership data

Exception Rules

Exception parcels are locked from normal flow

Appear in a dedicated exception queue

Require admin resolution

All resolutions are audited

9. Technology Stack
   Frontend

Language: TypeScript

Framework: React

Meta-framework: Next.js (App Router)

Styling: Tailwind CSS

Frontend Principles

No business logic in UI

Stateless where possible

All mutations go through backend APIs

Role-based routing

Backend

Runtime: Node.js

Language: TypeScript

Framework: NestJS

ORM: Prisma ORM

Database: PostgreSQL

Backend Principles

Modular architecture

Domain-driven design

Services enforce business rules

Controllers are thin

Transactions for critical operations

10. Authentication & Security
    Authentication

JWT-based authentication

Short-lived access tokens

Secure refresh tokens

Authorization

Role-based access control (RBAC)

Roles:

USER

WAREHOUSE_STAFF

ADMIN

Security Rules

Users can only access their own parcels

Warehouse staff cannot modify user data

Admin overrides are logged

Rate limiting on sensitive endpoints

Input validation on all requests

11. Audit Logging
    Must Be Logged

Parcel state changes

Delivery requests

Delivery completion

Exception creation and resolution

Admin overrides

Failed critical actions

Audit Log Properties

Immutable

Timestamped

Linked to actor (user/staff/admin)

Linked to parcel or delivery if applicable

12. Parcel Data Integrity Rules

Ownership is determined only by member code

Ownership changes require admin override

Parcel state machine is strictly enforced

Idempotency for critical actions

No duplicate deliveries or charges

13. Delivery & Payments
    Scope

One-time delivery fee per parcel

Fees calculated server-side

Rules

No delivery without payment confirmation

Payment status is stored and validated

Delivery state depends on payment success

(Payment provider implementation is abstracted.)

14. Non-Functional Requirements
    Reliability

Strong data consistency

Transactional writes

Graceful failure handling

Performance

Fast parcel intake for warehouse staff

Responsive dashboards

Scalability

Multi-warehouse ready

Multi-country ready (future)

Observability

Structured logging

Clear error messages

Monitoring-ready design

15. Explicit Out-of-Scope Items

The system must NOT include:

International forwarding logic

Customs automation

Subscription billing

Mobile applications (for now)

Real-time chat support

16. Final Instruction to Implementers (AI or Human)

Build this system as if it will be used by a real warehouse with real parcels and real money.
Favor correctness, clarity, and auditability over speed or shortcuts.
