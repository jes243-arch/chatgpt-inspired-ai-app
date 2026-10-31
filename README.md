# NovaChat

A professional AI chatbot application inspired by ChatGPT, built with Next.js, Tailwind CSS, Supabase, and OpenAI.

## Features
- Chat sidebar and conversation history
- New chat creation
- Message streaming from OpenAI
- Dark/light mode
- Supabase auth
- Private conversations
- File upload support
- Voice input and output
- Regenerate and copy response
- Web search toggle
- Responsive mobile/desktop layout

## Tech Stack
- Next.js 15
- React 18
- Tailwind CSS
- Supabase Postgres
- Supabase Auth
- OpenAI API

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_key
   ```

3. Create the Supabase tables and storage bucket from the SQL in the project docs.

4. Run the dev server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`

## Deployment

Deploy on Vercel with these environment variables set in project settings.

## Notes
This project is a working starter app. It includes real backend integration points and should be connected to your own Supabase Auth and OpenAI setup.
