import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL || 'your-email@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'your-app-password',
  },
});

export const sendPasswordResetEmail = async (to: string, resetLink: string) => {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log('\n======================================================');
    console.log(`[TESTING MODE] Forgot Password requested for: ${to}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('To send real emails, add SMTP_EMAIL and SMTP_PASSWORD to your backend/.env');
    console.log('======================================================\n');
    return;
  }

  const mailOptions = {
    from: `"QuizArena" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: 'Reset Your QuizArena Password',
    html: `
      <h2>QuizArena Password Reset</h2>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
