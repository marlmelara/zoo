# Frontend Architecture

The frontend is organized into **public pages**, **admin dashboard pages**, and a shared **API layer** that communicates with Supabase.

This separation allows multiple team members to work on different parts of the application without interfering with each other.

---

# Project Structure

```
src
│
├── api
│   ├── animals.js
│   ├── dashboard.js
│   ├── donations.js
│   ├── events.js
│   ├── inventory.js
│   ├── public.js
│   ├── staff.js
│   └── tickets.js
│
├── pages
│   ├── public
│   │   ├── Home
│   │   │   └── Home.jsx
│   │   ├── Tickets
│   │   │   └── Tickets.jsx
│   │   ├── Shop
│   │   │   └── Shop.jsx
│   │   └── Donations
│   │       └── Donations.jsx
│   │
│   └── dashboards
│       └── Admin
│           ├── Dashboard.jsx
│           └── tabs
│               ├── Animals.jsx
│               ├── Staff.jsx
│               ├── AdminTickets.jsx
│               ├── Events.jsx
│               └── Inventory.jsx
│
├── components
│   ├── Layout.jsx
│   └── ErrorBoundary.jsx
│
├── contexts
│   └── AuthContext.jsx
│
├── lib
│   └── supabase.js
│
├── utils
│   └── apiHandler.js
```

---

# Public vs Admin Routes

The application separates the **public website** from the **internal admin dashboard**.

## Public Routes

These routes are accessible to visitors.

```
/               → Zoo homepage
/tickets        → Public ticket purchase
/shop           → Gift shop
/donations      → Donation page
/login          → Employee login
```

Public pages are located in:

```
src/pages/public
```

---

## Admin Dashboard Routes

These routes require authentication and are used by zoo employees.

```
/dashboard
/dashboard/admin
/dashboard/animals
/dashboard/staff
/dashboard/tickets
/dashboard/events
/dashboard/inventory
```

Admin pages are located in:

```
src/pages/dashboards/Admin
```

---

# API Layer (Supabase)

All database communication is handled through the API helper functions located in:

```
src/api
```

Examples include:

- `animals.js`
- `events.js`
- `inventory.js`
- `tickets.js`
- `staff.js`
- `dashboard.js`

Example usage inside a component:

```javascript
import { getAdminEvents } from '../../api/events';

const events = await getAdminEvents();
```

Using a centralized API layer keeps components clean and avoids writing raw Supabase queries inside UI code.

---

# Notes for Team Members

- Build UI pages inside `src/pages`
- Call database functions from `src/api`
- Avoid writing Supabase queries directly inside components
- Admin pages should use the `/dashboard/...` routes
- Public pages should remain outside the dashboard structure

---

# Running the Project

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

The app will run locally at:

```
http://localhost:5173
```