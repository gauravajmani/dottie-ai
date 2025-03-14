# Dottie AI - Your Personal Assistant

Dottie is a comprehensive AI-powered personal assistant that helps you manage emails, calendar events, phone calls, and tasks efficiently. Built with modern web technologies and best practices in mind.

## Features

- **Email Management**
  - Gmail and Outlook integration
  - Smart email drafting and scheduling
  - Email summarization and filtering
  - Priority inbox management

- **Calendar Management**
  - Google Calendar and Outlook Calendar integration
  - Smart scheduling and availability checking
  - Meeting coordination and reminders
  - Time zone handling
  - Recurring event management

- **Phone Call Assistance**
  - Twilio integration for call handling
  - Call scheduling and reminders
  - Call recording (with consent)
  - Call transcription
  - Voicemail management

- **Location Services**
  - Google Maps integration
  - Location search and directions
  - Business information lookup
  - Travel time estimation

- **Task Management**
  - Smart to-do lists
  - Priority-based task organization
  - Reminders and notifications
  - Progress tracking

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma
- **APIs**:
  - Gmail API
  - Google Calendar API
  - Outlook REST API
  - Twilio API
  - Google Maps API
  - OpenAI API

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/dottie-ai.git
   cd dottie-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your API keys and credentials in `.env.local`

4. Initialize the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
dottie-ai/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── (auth)/           # Authentication routes
│   ├── dashboard/        # Dashboard pages
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── ui/               # UI components
│   ├── email/            # Email components
│   ├── calendar/         # Calendar components
│   └── calls/            # Call-related components
├── lib/                  # Utility functions and shared logic
│   ├── api/             # API client functions
│   ├── utils/           # Helper utilities
│   └── types/           # TypeScript types
├── prisma/              # Database schema and migrations
└── public/              # Static assets
```

## Environment Variables

Required environment variables:

```env
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Email
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=

# Calendar
GOOGLE_CALENDAR_API_KEY=
OUTLOOK_CALENDAR_API_KEY=

# Phone
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Maps
GOOGLE_MAPS_API_KEY=

# AI
OPENAI_API_KEY=
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting and deployment
- All the API providers that make this possible