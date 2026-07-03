const cron = require('node-cron');
const { releaseExpiredHolds } = require('../services/seatService');
const { expireOffers } = require('../services/waitlistService');

function initScheduler(io) {
  // check for expired seat holds every 30 sec
  cron.schedule('*/30 * * * * *', async () => {
    try { await releaseExpiredHolds(io); }
    catch (e) { console.error('Hold release error:', e.message); }
  });

  // check for expired waitlist offers every minute
  cron.schedule('* * * * *', async () => {
    try { await expireOffers(); }
    catch (e) { console.error('Offer expiry error:', e.message); }
  });

  console.log('Scheduler started - monitoring seat holds & waitlist offers');
}

module.exports = { initScheduler };
