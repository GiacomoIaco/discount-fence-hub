import 'dotenv/config';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function testResendEmail() {
  const testEmail = 'giacomo@highfortitude.com'; // Your email

  console.log('Testing Resend email...');
  console.log('API Key exists:', !!RESEND_API_KEY);
  console.log('API Key prefix:', RESEND_API_KEY?.substring(0, 10) + '...');

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not found in environment');
    return;
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Resend Test Email</h2>
      <p>This is a test email from <strong>Discount Fence Hub</strong> to verify Resend integration.</p>
      <p style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
        <strong>Sent at:</strong> ${new Date().toLocaleString()}<br/>
        <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}
      </p>
      <p style="color: #059669;">If you received this, Resend is working correctly!</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated test from the Discount Fence Hub application.
      </p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Discount Fence Hub <giacomo@discountfenceusa.com>',
        to: [testEmail],
        subject: 'Resend Test - Discount Fence Hub',
        html: emailHtml,
      }),
    });

    if (response.ok) {
      console.log('Email sent successfully to:', testEmail);
      console.log('Status:', response.status);
    } else {
      const errorText = await response.text();
      console.error('Resend error:', response.status);
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

testResendEmail();
