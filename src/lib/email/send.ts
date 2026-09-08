import "server-only";
import nodemailer from "nodemailer";

export function createMailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendWeeklyDigestEmail(to: string, subject: string, html: string) {
  const mailer = createMailer();
  await mailer.sendMail({
    from: `Vencimientos Tributarios <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
