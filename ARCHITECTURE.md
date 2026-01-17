
# Pakibay Marketplace Architecture

## 1. System Overview

Pakibay is a secure, scalable online marketplace tailored for the Pakistani market, inspired by eBay. The platform consists of:

- **Frontend:** Modern web app (React, Next.js) with mobile-first design, supporting Urdu and English localization.
- **Backend:** RESTful API (Node.js/Express or Django/FastAPI), handling business logic, authentication, auctions, and payments.
- **Database:** Relational (PostgreSQL/MySQL) for transactional data; Redis for caching and real-time bidding.
- **Cloud Infrastructure:** Deployed on AWS/Azure/GCP with containerization (Docker), CI/CD, and managed secrets.

## 2. User Roles & Flows

### Roles
- **Buyer:** Browses, bids, purchases items, rates sellers.
- **Seller:** Lists items, manages auctions/sales, rates buyers.
- **Bidder:** Places bids on auction items (can be buyer or seller).
- **Admin:** Manages users, content, disputes, and platform policies.

### Flows
- **Registration/Login:** Secure signup (email, phone, social), 2FA optional.
- **Browse/Search:** Filter by category, price, location, seller rating.
- **Listing:** Seller creates item listing (fixed price or auction).
- **Bidding:** Bidder places bids; system updates highest bid in real-time.
- **Purchase:** Buyer completes payment (COD, bank transfer, digital wallets).
- **Rating/Review:** After transaction, buyer/seller rate each other.
- **Dispute Resolution:** Admin reviews and resolves reported issues.

## 3. Data Models

### User
- id (PK)
- name
- email
- phone
- password_hash
- role (buyer/seller/admin)
- rating
- address
- verified (bool)
- created_at, updated_at

### Item
- id (PK)
- seller_id (FK: User)
- title
- description
- category
- images (array)
- price
- auction (bool)
- auction_end_time
- status (active/sold/expired)
- created_at, updated_at

### Bid
- id (PK)
- item_id (FK: Item)
- bidder_id (FK: User)
- amount
- timestamp

### Transaction
- id (PK)
- item_id (FK: Item)
- buyer_id (FK: User)
- seller_id (FK: User)
- price
- payment_method
- status (pending/complete/disputed)
- created_at, updated_at

### Rating
- id (PK)
- rater_id (FK: User)
- ratee_id (FK: User)
- transaction_id (FK: Transaction)
- score (1-5)
- comment
- created_at

## 4. REST API Design

### Auth
- POST /api/auth/register — Register new user
- POST /api/auth/login — Login
- POST /api/auth/logout — Logout
- POST /api/auth/verify — Verify email/phone

### Users
- GET /api/users/:id — Get user profile
- PUT /api/users/:id — Update profile
- GET /api/users/:id/ratings — Get user ratings

### Items
- GET /api/items — List/search items
- POST /api/items — Create item
- GET /api/items/:id — Get item details
- PUT /api/items/:id — Update item
- DELETE /api/items/:id — Delete item

### Bids
- GET /api/items/:id/bids — List bids for item
- POST /api/items/:id/bids — Place bid

### Transactions
- POST /api/items/:id/purchase — Buy item
- GET /api/transactions/:id — Get transaction details

### Ratings
- POST /api/transactions/:id/rate — Rate user after transaction

### Admin
- GET /api/admin/users — List users
- PUT /api/admin/users/:id — Update user (ban, verify)
- GET /api/admin/disputes — List disputes
- POST /api/admin/disputes/:id/resolve — Resolve dispute

## 5. Auction & Bidding Logic

1. Seller lists item as auction, sets starting price and end time.
2. Bidders place bids; each bid must be higher than current highest.
3. System updates highest bid in real-time (WebSocket/Redis pub-sub).
4. At auction end:
	- Highest bidder wins.
	- Transaction is created; buyer notified.
	- Seller confirms shipment; buyer completes payment.
5. Anti-sniping: Optionally extend auction if bid placed in last minute.
6. Admin can cancel fraudulent auctions/bids.

## 6. Trust & Rating System

- After each transaction, buyer and seller rate each other (1-5 stars, comment).
- Aggregate ratings shown on profiles and listings.
- New users flagged as unverified until first transaction.
- Admin monitors for abuse (fake ratings, disputes).

## 7. Security Assumptions & Protections

- All sensitive data encrypted in transit (TLS) and at rest.
- Passwords hashed (bcrypt/argon2).
- Input validation and sanitization (prevent XSS, SQLi).
- Role-based access control (RBAC) for API endpoints.
- Rate limiting and anti-bot protections.
- Audit logs for admin actions and critical events.
- Secure file uploads (virus scan, size/type checks).
- Payment integration via PCI-compliant providers.
- Regular vulnerability scans and patching.

## 8. MVP vs Post-MVP Features

### MVP
- User registration/login
- Item listing (fixed price & auction)
- Bidding & purchase flows
- Ratings & reviews
- Admin dashboard
- Basic dispute resolution

### Post-MVP
- Mobile app (iOS/Android)
- Advanced search (AI recommendations)
- Chat/messaging between users
- Escrow payments
- Social login (Google, Facebook)
- Seller analytics dashboard
- Multi-language support (Urdu, English)
- Automated fraud detection

---
This document outlines a production-ready architecture for Pakibay, balancing security, scalability, and local market needs. Further details to be refined during implementation.
