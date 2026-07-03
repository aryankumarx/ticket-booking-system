# TicketFlow — Ticket Booking System

A full-stack ticket booking platform for movies and concerts. Features real-time seat map, seat hold with TTL auto-release, waitlist with automatic seat assignment on cancellation, and QR code ticket generation with email delivery.

### 🌐 Live Deployment
- **Frontend App**: [https://ticket-booking-system-sigma-liard.vercel.app/](https://ticket-booking-system-sigma-liard.vercel.app/)
- **Backend API**: [https://ticket-booking-system-1mwl.onrender.com](https://ticket-booking-system-1mwl.onrender.com)


## Features

- **Role-based Auth** — Customer, Organiser, Admin with JWT
- **Visual Seat Map** — Interactive grid with real-time status (available/held/booked)
- **Seat Hold TTL** — Configurable hold timer (default 10 min), auto-releases on expiry
- **Concurrency Protection** — Atomic MongoDB operations prevent double-booking
- **Waitlist** — Auto-assigns seats on cancellation with time-limited email offers
- **QR Code Tickets** — Generated on booking, delivered via email
- **Real-time Updates** — Socket.io broadcasts seat changes to all connected clients
- **Organiser Dashboard** — Booking summary, revenue tracking per event

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express |
| Database | MongoDB (Atlas) |
| Auth | JWT + bcrypt |
| Real-time | Socket.io |
| QR Code | `qrcode` package |
| Email | Nodemailer (Gmail / Ethereal) |
| Frontend | React (Vite) |
| Styling | Vanilla CSS |

## Setup Guide

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (free tier works)
- Gmail account (optional, for real email delivery)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/ticket-booking-system.git
cd ticket-booking-system
```

### 2. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configure environment
```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your values:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ticket-booking
JWT_SECRET=any_random_string
EMAIL_USER=your_gmail@gmail.com       # optional
EMAIL_PASS=your_app_password           # optional (Gmail App Password)
FRONTEND_URL=http://localhost:5173
SEAT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15
PORT=5000
```

> If you skip email config, the app uses Ethereal (fake SMTP). Check server console for preview links.

### 4. Start the app
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:5000`.

### 5. Quick test flow
1. Register as **Admin** → Create a venue with seat layout
2. Register as **Organiser** → Create an event at that venue
3. Register as **Customer** → Browse events, select seats, book tickets
4. Try opening two browser windows and selecting the same seat — only one will succeed

---

## API Documentation

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user | No |
| POST | `/api/auth/login` | Login | No |

**Register body:**
```json
{ "name": "John", "email": "john@test.com", "password": "123456", "role": "customer" }
```

### Venues (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/venues` | Create venue |
| GET | `/api/venues` | List venues |
| GET | `/api/venues/:id` | Get venue |

**Create venue body:**
```json
{
  "name": "PVR Phoenix",
  "address": "MG Road, Bangalore",
  "seatLayout": {
    "rows": 8,
    "seatsPerRow": 12,
    "categories": [
      { "name": "Premium", "rowStart": 1, "rowEnd": 2, "color": "#f59e0b" },
      { "name": "Standard", "rowStart": 3, "rowEnd": 6, "color": "#22c55e" },
      { "name": "Economy", "rowStart": 7, "rowEnd": 8, "color": "#3b82f6" }
    ]
  }
}
```

### Events
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/events` | Create event (auto-generates seats) | Organiser |
| GET | `/api/events` | Browse events (supports `?type=movie&search=avengers`) | No |
| GET | `/api/events/:id` | Event details | No |
| GET | `/api/events/:id/seats` | Seat map data | No |
| GET | `/api/events/:id/summary` | Booking & revenue summary | Organiser |

### Bookings
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/bookings/hold` | Hold seats (concurrency-safe) | Yes |
| POST | `/api/bookings/confirm` | Confirm booking, get QR | Yes |
| GET | `/api/bookings` | Booking history | Yes |
| POST | `/api/bookings/:id/cancel` | Cancel booking (triggers waitlist) | Yes |
| POST | `/api/bookings/release` | Release held seats | Yes |

**Hold seats body:**
```json
{ "eventId": "...", "seatIds": ["seatId1", "seatId2"] }
```

### Waitlist
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/waitlist/join` | Join waitlist for sold-out category | Yes |
| GET | `/api/waitlist/status/:eventId` | Check your position | Yes |
| POST | `/api/waitlist/accept/:token` | Accept seat offer | Yes |
| DELETE | `/api/waitlist/:id` | Leave waitlist | Yes |

---

## Database Schema

### User
```
{ name, email, password (hashed), role: customer|organiser|admin, timestamps }
```

### Venue
```
{ name, address, seatLayout: { rows, seatsPerRow, categories: [{ name, rowStart, rowEnd, color }] }, createdBy }
```

### Event
```
{ title, type: movie|concert, description, venue (ref), organiser (ref), date, time, pricing: [{ category, price }], status }
```

### Seat
```
{ event (ref), row, number, label, category, categoryColor, status: available|held|booked, heldBy, holdExpiresAt, bookedBy, bookingRef }
```
Indexes: `(event, row, number)` unique, `(status, holdExpiresAt)` for expired hold queries.

### Booking
```
{ bookingRef (UUID), event (ref), user (ref), seats: [{ seatId, label, category, price }], totalAmount, status, qrCode (base64) }
```

### Waitlist
```
{ event (ref), user (ref), category, position, status: waiting|offered|expired|converted, offerExpiresAt, offerToken }
```

---

## Seat Hold & Waitlist Logic

### Seat Hold TTL
1. Customer selects seats → `POST /api/bookings/hold` sets `status: 'held'` with `holdExpiresAt = now + 10min`
2. Uses `findOneAndUpdate` with filter `{ status: 'available' }` — only one request succeeds per seat (concurrency protection)
3. Scheduler runs every 30 seconds — finds seats where `holdExpiresAt < now` and resets them to `available`
4. On every seat map fetch, expired holds are also cleaned up (belt-and-suspenders approach)
5. Socket.io broadcasts status changes to all connected clients in real-time
6. Frontend shows countdown timer during checkout

### Waitlist Auto-Assignment
1. When all seats in a category are booked, customer can join waitlist
2. On booking cancellation → `offerToNext()` finds the next person in queue (sorted by position)
3. Sets their status to `offered`, generates a unique token, sends email with time-limited link (15 min default)
4. If they accept → status becomes `converted`, they can book normally
5. If timer expires → scheduler sets status to `expired`, auto-cascades to next person in line
6. This continues until someone accepts or the waitlist is empty

---

## Deployment

### Backend (Render)
1. Push to GitHub
2. Create a new Web Service on Render
3. Set root directory to `server`, build command `npm install`, start command `node index.js`
4. Add all env vars from `.env`

### Frontend (Vercel)
1. Import the GitHub repo on Vercel
2. Set root directory to `client`, framework preset to Vite
3. Add env var `VITE_API_URL` pointing to your Render backend URL
