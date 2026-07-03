const Waitlist = require('../models/Waitlist');
const User = require('../models/User');
const Event = require('../models/Event');
const { sendWaitlistOffer } = require('./emailService');
const { v4: uuidv4 } = require('uuid');

async function joinWaitlist(eventId, userId, category, seatsRequested) {
  // check if already waiting
  const existing = await Waitlist.findOne({
    event: eventId, user: userId, category,
    status: { $in: ['waiting', 'offered'] }
  });
  if (existing) throw new Error('Already on the waitlist for this category');

  // figure out position in queue
  const last = await Waitlist.findOne({ event: eventId, category }).sort({ position: -1 });
  const position = last ? last.position + 1 : 1;

  return Waitlist.create({
    event: eventId, user: userId, category,
    seatsRequested: seatsRequested || 1, position, status: 'waiting'
  });
}

// called when someone cancels - offers the seat to next person in waitlist
async function offerToNext(eventId, category) {
  const ttl = parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES) || 15;

  const next = await Waitlist.findOne({
    event: eventId, category, status: 'waiting'
  }).sort({ position: 1 });

  if (!next) return null; // nobody waiting

  const token = uuidv4();
  next.status = 'offered';
  next.offeredAt = new Date();
  next.offerExpiresAt = new Date(Date.now() + ttl * 60 * 1000);
  next.offerToken = token;
  await next.save();

  // send them an email
  const user = await User.findById(next.user);
  const event = await Event.findById(eventId);
  if (user && event) {
    await sendWaitlistOffer(user, event, category, token, ttl);
  }

  return next;
}

async function acceptOffer(token, userId) {
  const entry = await Waitlist.findOne({ offerToken: token, status: 'offered' }).populate('event');
  if (!entry) throw new Error('Invalid or expired offer');
  if (entry.user.toString() !== userId) throw new Error('This offer belongs to someone else');

  if (new Date() > entry.offerExpiresAt) {
    entry.status = 'expired';
    await entry.save();
    await offerToNext(entry.event._id, entry.category); // pass it along
    throw new Error('Sorry, the offer has expired');
  }

  entry.status = 'converted';
  await entry.save();
  return entry;
}

// check for offers that timed out and cascade to next person
async function expireOffers() {
  const expired = await Waitlist.find({ status: 'offered', offerExpiresAt: { $lt: new Date() } });
  
  for (let offer of expired) {
    offer.status = 'expired';
    await offer.save();
    await offerToNext(offer.event, offer.category);
  }
  return expired.length;
}

module.exports = { joinWaitlist, offerToNext, acceptOffer, expireOffers };
