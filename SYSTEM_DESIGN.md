# System Design — TicketFlow Ticket Booking Platform

## Overview

TicketFlow is a ticket booking system for movies and concerts where customers pick seats from a visual map, held seats auto-release if checkout is abandoned, sold-out events offer a waitlist with automatic seat assignment on cancellation, and every confirmed booking produces an email with a QR code ticket. The system has three roles: Admin (manages venues), Organiser (creates events), and Customer (browses, books, cancels).

The backend is built with Node.js and Express, using MongoDB as the database, Socket.io for real-time communication, and a cron-based scheduler for time-based operations like hold expiry and waitlist offer management.

## Seat Hold and TTL Mechanism

When a customer selects seats and clicks "Hold & Proceed", the system places a temporary hold on those seats. Each held seat gets a `holdExpiresAt` timestamp set to the current time plus a configurable TTL (default 10 minutes). The seat's status changes from `available` to `held`, and the `heldBy` field stores the user's ID.

The hold expiry is enforced through two mechanisms working together. First, a cron job runs every 30 seconds and queries for seats where `status = 'held'` and `holdExpiresAt < now`. Any matches are reset to `available` with all hold-related fields cleared. Second, every time a client fetches the seat map via the API, the server runs the same cleanup query before returning results. This belt-and-suspenders approach ensures holds are released even if the scheduler has a brief delay.

When holds are released, the server emits Socket.io events to all clients viewing that event's seat map. The frontend listens for these `seats:updated` events and updates the seat grid in real time without requiring a page refresh. The customer in the checkout flow also sees a countdown timer — when it hits zero, the UI redirects them back to seat selection with a message that their hold expired.

## Concurrency Prevention

The core concurrency protection relies on MongoDB's atomic `findOneAndUpdate` operation. When a customer tries to hold a seat, the query includes a filter `{ _id: seatId, status: 'available' }` along with an update to set `status: 'held'`. Because MongoDB guarantees atomicity at the document level, if two users simultaneously attempt to hold the same seat, only one `findOneAndUpdate` will find the document with `status: 'available'` and succeed. The other will get a null result (no document matched), and the system reports those seats as unavailable.

If a customer selected multiple seats and some fail to hold (because another user grabbed them first), the system automatically rolls back the ones that did succeed — releasing them back to `available`. This all-or-nothing approach prevents partial holds that could confuse the user.

The same atomic pattern applies to booking confirmation: the filter checks `{ status: 'held', heldBy: userId }`, ensuring only the user who holds the seats can confirm them, and preventing any race condition between the hold expiry and the confirmation click.

## Waitlist Auto-Assignment Flow

When all seats in a particular category (e.g., Premium) are booked, the event shows a "Join Waitlist" button for that category. Customers join a queue tracked by position number (1, 2, 3...).

When a booking is cancelled, the system identifies which seat categories were freed and calls `offerToNext()` for each. This function finds the waitlist entry with `status: 'waiting'` and the lowest position number for that event and category. It generates a unique UUID token, sets the entry's status to `offered`, and records `offeredAt` and `offerExpiresAt` timestamps (default 15 minutes from now).

The system sends an email to the waitlisted customer containing a time-limited link with the unique token. This link leads to the frontend where the customer can accept the offer and proceed to seat selection and booking.

## Time-Limited Offer Handling

Once a waitlist offer is made, a timer starts. The scheduler checks every 60 seconds for offers where `status = 'offered'` and `offerExpiresAt < now`. Expired offers get their status changed to `expired`, and the system immediately calls `offerToNext()` again to cascade the offer to the next person in the queue.

When a customer clicks the link from their email and accepts the offer, the system verifies three things: the token is valid, it belongs to the requesting user, and the offer has not expired. If all checks pass, the entry's status changes to `converted` and the customer can proceed to book available seats in that category.

If the offer is expired by the time they click, the system tells them it expired and automatically offers it to the next person. This cascading continues until someone accepts or the waitlist is exhausted. The approach balances fairness (first-come-first-served ordering) with practicality (not holding seats indefinitely for unresponsive customers).

## Architecture Decisions

MongoDB was chosen over SQL primarily for its flexible document model — venue seat layouts and booking seat arrays fit naturally as embedded documents rather than requiring complex joins. The atomic `findOneAndUpdate` provides sufficient concurrency control for the seat-booking use case without needing distributed locks or database-level row locking.

Socket.io enables real-time seat map updates so customers see changes instantly without polling. The server emits events to event-specific rooms, meaning clients only receive updates for the event they are currently viewing.

The scheduler approach (cron-based) was chosen over MongoDB TTL indexes because TTL indexes only delete documents — they cannot update a field from `held` to `available`. The cron job gives us full control over what happens when a hold expires, including triggering Socket.io notifications to connected clients.
