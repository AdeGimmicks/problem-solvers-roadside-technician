# Problem Solvers Roadside Technician

Production-ready Node/Express roadside assistance website for a mobile roadside technician serving Chicago and surrounding suburbs.

## Stack

- HTML5, CSS3, vanilla JavaScript
- Node.js and Express.js
- MongoDB Atlas with Mongoose
- EJS views
- Stripe Checkout
- Google Maps embed/API configuration
- Nodemailer email notifications
- Twilio SMS notifications for owner/store manager alerts
- Helmet, rate limiting, CSRF protection, input validation, password hashing, JWT helper
- Render deployment config

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in MongoDB Atlas, admin, Stripe, SMTP, Google Maps, and business values.
3. Install dependencies:

```bash
npm install
```

4. Seed initial settings, pricing, reviews, service areas, and the first admin:

```bash
npm run seed
```

5. Start development:

```bash
npm run dev
```

## Main Routes

- `/` home
- `/services`
- `/about`
- `/contact`
- `/request-service`
- `/dashboard/login`
- `/dashboard`

## Admin Workflow

Customer request status flow:

Pending -> Accepted -> En Route -> Arrived -> Completed -> Payment Recorded

Requests can also be marked Cancelled. Every status change is stored in MongoDB in `statusHistory`.

## Collections

- `admins`
- `customers`
- `serviceRequests`
- `payments`
- `reviews`
- `photos`
- `pricing`
- `businessSettings`
- `serviceAreas`

## Deployment

This project includes `render.yaml`. Connect the GitHub repository to Render, set the required environment variables, and deploy with `npm start`.

Stripe Checkout uses environment variables only. Reuse the existing Stripe account by setting `STRIPE_SECRET_KEY=sk_live_...` and `STRIPE_PUBLISHABLE_KEY=pk_live_...` in Render. Do not paste Stripe keys into the source code.

SMS alerts use Twilio environment variables only. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_MESSAGING_SERVICE_SID` for the approved A2P Messaging Service or `TWILIO_FROM_NUMBER` for direct sending in Render. Set `SMS_TO_NUMBER` if owner alerts should go to a different phone number than the dashboard business/text number.

## Notes

- This is not a towing-company site. The copy and workflows are focused on mobile roadside service at the customer's location.
- Photo upload currently stores local image paths under `public/uploads`. For production image hosting, paste Cloudinary URLs through the dashboard or replace the upload service with Cloudinary storage.
- Apple Pay and Google Pay are supported through Stripe Checkout when the Stripe account and domain are configured for wallet payments.
