const QRCode = require('qrcode');

// generate QR code as base64 data url from booking reference
async function generateQR(bookingRef) {
  const data = JSON.stringify({
    ref: bookingRef,
    url: `${process.env.FRONTEND_URL}/verify/${bookingRef}`,
    ts: new Date().toISOString()
  });

  const dataUrl = await QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' }
  });
  return dataUrl;
}

module.exports = { generateQR };
