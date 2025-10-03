import { Resend } from 'resend';

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

interface BookingEmailData {
  userEmail: string;
  userName: string;
  matchTitle: string;
  matchDate: string;
  matchTime: string;
  matchDuration: number;
  location: string;
  isPrivate: boolean;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  try {
    await resend.emails.send({
      from: 'Apex Padel <noreply@apexpadel.com>',
      to: data.userEmail,
      subject: `Booking Confirmed: ${data.matchTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .match-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
              .detail-row { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #6b7280; }
              .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px; }
              .badge { display: inline-block; background-color: #a855f7; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎾 Booking Confirmed!</h1>
              </div>
              <div class="content">
                <p>Hi ${data.userName},</p>
                <p>Your spot has been confirmed for the following match:</p>

                <div class="match-details">
                  <h2 style="margin-top: 0; color: #10b981;">${data.matchTitle}</h2>
                  ${data.isPrivate ? '<span class="badge">🔒 Private Match</span>' : ''}

                  <div class="detail-row">
                    <span class="label">📅 Date:</span>
                    <span class="value">${data.matchDate}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">⏰ Time:</span>
                    <span class="value">${data.matchTime} (${data.matchDuration} minutes)</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">📍 Location:</span>
                    <span class="value">${data.location}</span>
                  </div>
                </div>

                <p>See you on the court! 🏆</p>

                <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                  If you need to cancel your booking, please visit the match page in the Apex Padel app.
                </p>
              </div>

              <div class="footer">
                <p>Apex Padel - Your Padel Community</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
    return { success: false, error };
  }
}

export async function sendCancellationEmail(data: BookingEmailData) {
  try {
    await resend.emails.send({
      from: 'Apex Padel <noreply@apexpadel.com>',
      to: data.userEmail,
      subject: `Booking Cancelled: ${data.matchTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .match-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
              .detail-row { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #6b7280; }
              .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px; }
              .badge { display: inline-block; background-color: #a855f7; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Cancelled</h1>
              </div>
              <div class="content">
                <p>Hi ${data.userName},</p>
                <p>Your booking has been cancelled for the following match:</p>

                <div class="match-details">
                  <h2 style="margin-top: 0; color: #ef4444;">${data.matchTitle}</h2>
                  ${data.isPrivate ? '<span class="badge">🔒 Private Match</span>' : ''}

                  <div class="detail-row">
                    <span class="label">📅 Date:</span>
                    <span class="value">${data.matchDate}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">⏰ Time:</span>
                    <span class="value">${data.matchTime} (${data.matchDuration} minutes)</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">📍 Location:</span>
                    <span class="value">${data.location}</span>
                  </div>
                </div>

                <p>Your spot is now available for other players. You can book other matches anytime in the Apex Padel app.</p>
              </div>

              <div class="footer">
                <p>Apex Padel - Your Padel Community</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
    return { success: false, error };
  }
}

interface CreatorNotificationData {
  creatorEmail: string;
  creatorName: string;
  playerName: string;
  matchTitle: string;
  matchDate: string;
  matchTime: string;
  location: string;
  availableSlots: number;
  maxPlayers: number;
}

export async function sendCreatorBookingNotification(data: CreatorNotificationData) {
  try {
    await resend.emails.send({
      from: 'Apex Padel <noreply@apexpadel.com>',
      to: data.creatorEmail,
      subject: `New Player Joined: ${data.matchTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .match-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
              .detail-row { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #6b7280; }
              .player-highlight { background-color: #d1fae5; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #047857; }
              .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎾 New Player Joined!</h1>
              </div>
              <div class="content">
                <p>Hi ${data.creatorName},</p>
                <p><span class="player-highlight">${data.playerName}</span> just joined your match!</p>

                <div class="match-details">
                  <h2 style="margin-top: 0; color: #10b981;">${data.matchTitle}</h2>

                  <div class="detail-row">
                    <span class="label">📅 Date:</span>
                    <span class="value">${data.matchDate}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">⏰ Time:</span>
                    <span class="value">${data.matchTime}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">📍 Location:</span>
                    <span class="value">${data.location}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">👥 Players:</span>
                    <span class="value">${data.maxPlayers - data.availableSlots}/${data.maxPlayers} (${data.availableSlots} slot${data.availableSlots === 1 ? '' : 's'} available)</span>
                  </div>
                </div>

                <p>See you on the court! 🏆</p>
              </div>

              <div class="footer">
                <p>Apex Padel - Your Padel Community</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send creator booking notification:', error);
    return { success: false, error };
  }
}

export async function sendCreatorCancellationNotification(data: CreatorNotificationData) {
  try {
    await resend.emails.send({
      from: 'Apex Padel <noreply@apexpadel.com>',
      to: data.creatorEmail,
      subject: `Player Cancelled: ${data.matchTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .match-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
              .detail-row { margin: 10px 0; }
              .label { font-weight: bold; color: #374151; }
              .value { color: #6b7280; }
              .player-highlight { background-color: #fef3c7; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #92400e; }
              .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Player Cancelled</h1>
              </div>
              <div class="content">
                <p>Hi ${data.creatorName},</p>
                <p><span class="player-highlight">${data.playerName}</span> cancelled their booking for your match.</p>

                <div class="match-details">
                  <h2 style="margin-top: 0; color: #f59e0b;">${data.matchTitle}</h2>

                  <div class="detail-row">
                    <span class="label">📅 Date:</span>
                    <span class="value">${data.matchDate}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">⏰ Time:</span>
                    <span class="value">${data.matchTime}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">📍 Location:</span>
                    <span class="value">${data.location}</span>
                  </div>

                  <div class="detail-row">
                    <span class="label">👥 Players:</span>
                    <span class="value">${data.maxPlayers - data.availableSlots}/${data.maxPlayers} (${data.availableSlots} slot${data.availableSlots === 1 ? '' : 's'} available)</span>
                  </div>
                </div>

                <p>The spot is now available for other players.</p>
              </div>

              <div class="footer">
                <p>Apex Padel - Your Padel Community</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send creator cancellation notification:', error);
    return { success: false, error };
  }
}
