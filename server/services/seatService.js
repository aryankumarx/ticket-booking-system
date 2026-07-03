const Seat = require('../models/Seat');

// try to hold seats for a user - uses atomic update so two users cant grab same seat
async function holdSeats(eventId, seatIds, userId) {
  const ttl = parseInt(process.env.SEAT_HOLD_TTL_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
  
  let held = [];
  let failed = [];

  for (let id of seatIds) {
    // this only works if seat is still available - thats the concurrency trick
    const seat = await Seat.findOneAndUpdate(
      { _id: id, event: eventId, status: 'available' },
      { $set: { status: 'held', heldBy: userId, heldAt: new Date(), holdExpiresAt: expiresAt } },
      { new: true }
    );
    if (seat) held.push(seat);
    else failed.push(id);
  }

  // if some failed, rollback the ones we did grab
  if (failed.length > 0 && held.length > 0) {
    await Seat.updateMany(
      { _id: { $in: held.map(s => s._id) } },
      { $set: { status: 'available', heldBy: null, heldAt: null, holdExpiresAt: null } }
    );
    return { success: false, message: 'Some seats were already taken', failedSeats: failed };
  }

  if (held.length === 0) {
    return { success: false, message: 'Those seats are no longer available', failedSeats: seatIds };
  }

  return { success: true, seats: held, holdExpiresAt: expiresAt };
}

// runs on a timer - finds expired holds and releases them
async function releaseExpiredHolds(io) {
  const now = new Date();
  const expired = await Seat.find({ status: 'held', holdExpiresAt: { $lt: now } });
  if (expired.length === 0) return 0;

  await Seat.updateMany(
    { status: 'held', holdExpiresAt: { $lt: now } },
    { $set: { status: 'available', heldBy: null, heldAt: null, holdExpiresAt: null } }
  );

  // notify connected clients about freed seats
  if (io && expired.length > 0) {
    const grouped = {};
    expired.forEach(seat => {
      const eid = seat.event.toString();
      if (!grouped[eid]) grouped[eid] = [];
      grouped[eid].push({ _id: seat._id, row: seat.row, number: seat.number, status: 'available' });
    });
    for (let [eventId, seats] of Object.entries(grouped)) {
      io.to(`event:${eventId}`).emit('seats:updated', seats);
    }
  }

  console.log(`Released ${expired.length} expired holds`);
  return expired.length;
}

// mark held seats as booked
async function confirmSeats(seatIds, userId, bookingRef) {
  const res = await Seat.updateMany(
    { _id: { $in: seatIds }, status: 'held', heldBy: userId },
    { $set: { status: 'booked', bookedBy: userId, bookingRef, heldAt: null, holdExpiresAt: null } }
  );
  return res.modifiedCount === seatIds.length;
}

// free up seats when a booking gets cancelled
async function releaseSeats(seatIds, io, eventId) {
  await Seat.updateMany(
    { _id: { $in: seatIds } },
    { $set: { status: 'available', heldBy: null, heldAt: null, holdExpiresAt: null, bookedBy: null, bookingRef: null } }
  );
  if (io && eventId) {
    const updated = await Seat.find({ _id: { $in: seatIds } });
    io.to(`event:${eventId}`).emit('seats:updated', updated);
  }
}

// check if all seats in a category are gone
async function isCategorySoldOut(eventId, category) {
  const count = await Seat.countDocuments({ event: eventId, category, status: 'available' });
  return count === 0;
}

module.exports = { holdSeats, releaseExpiredHolds, confirmSeats, releaseSeats, isCategorySoldOut };
