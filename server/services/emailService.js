const nodemailer = require('nodemailer');

let transporter = null;

// sets up email - uses gmail if configured, otherwise falls back to ethereal (fake smtp for testing)
async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_USER !== 'your_gmail@gmail.com') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    console.log('Using Gmail for emails');
  } else {
    // ethereal gives us a fake inbox to test with
    const testAcc = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: testAcc.user, pass: testAcc.pass }
    });
    console.log('Using Ethereal test emails - check https://ethereal.email');
    console.log('  User:', testAcc.user, '| Pass:', testAcc.pass);
  }
  return transporter;
}

// send the booking confirmation with qr code attached inline
async function sendBookingConfirmation(user, booking, event, qrDataUrl) {
  try {
    const transport = await getTransporter();
    const seats = booking.seats.map(s => s.label).join(', ');
    const eventDate = new Date(event.date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const info = await transport.sendMail({
      from: `"TicketFlow" <${process.env.EMAIL_USER || 'noreply@ticketflow.com'}>`,
      to: user.email,
      subject: `Booking Confirmed - ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #1a1a2e; color: #eee; border-radius: 12px; overflow: hidden;">
          <div style="padding: 28px; text-align: center; background: linear-gradient(135deg, #667eea, #764ba2);">
            <h1 style="margin: 0; font-size: 22px;">Booking Confirmed!</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #a78bfa; margin-top: 0;">${event.title}</h2>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Time:</strong> ${event.time}</p>
            <p><strong>Seats:</strong> ${seats}</p>
            <p><strong>Total:</strong> Rs. ${booking.totalAmount}</p>
            <p><strong>Ref:</strong> ${booking.bookingRef}</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="color: #999; font-size: 13px;">Show this QR at the venue</p>
              <img src="${qrDataUrl}" alt="QR Code" style="width: 180px; height: 180px; background: #fff; padding: 8px; border-radius: 8px;" />
            </div>
          </div>
        </div>
      `
    });

    console.log('Confirmation email sent:', info.messageId);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Preview:', preview);
    return { messageId: info.messageId, preview };
  } catch (err) {
    // dont block booking if email fails
    console.error('Email failed:', err.message);
    return null;
  }
}

// notify waitlisted user that a seat opened up
async function sendWaitlistOffer(user, event, category, token, expiresMin) {
  try {
    const transport = await getTransporter();
    const link = `${process.env.FRONTEND_URL}/waitlist/accept/${token}`;

    const info = await transport.sendMail({
      from: `"TicketFlow" <${process.env.EMAIL_USER || 'noreply@ticketflow.com'}>`,
      to: user.email,
      subject: `Seat Available! - ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #1a1a2e; color: #eee; border-radius: 12px; overflow: hidden;">
          <div style="padding: 28px; text-align: center; background: linear-gradient(135deg, #f093fb, #f5576c);">
            <h1 style="margin: 0; font-size: 22px;">A Seat Opened Up!</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #f093fb; margin-top: 0;">${event.title}</h2>
            <p>A <strong>${category}</strong> seat is now available for you.</p>
            <p>You have <strong>${expiresMin} minutes</strong> to book it before it goes to the next person.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 30px; font-weight: bold;">
                Book Now
              </a>
            </div>
          </div>
        </div>
      `
    });

    console.log('Waitlist offer sent to', user.email);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Preview:', preview);
    return { messageId: info.messageId };
  } catch (err) {
    console.error('Waitlist email failed:', err.message);
    return null;
  }
}

module.exports = { sendBookingConfirmation, sendWaitlistOffer };
