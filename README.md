# Discount Fence USA Operations Hub

A modern, mobile-first web application for sales reps and operations teams at Discount Fence USA.

## 🚀 Features

### Sales Rep Interface
- **Voice-Enabled Requests**: Record pricing requests with AI transcription and parsing
- **Pre-Stain ROI Calculator**: Show customers DIY vs pre-stained cost comparisons
- **Client Presentations**: Full-screen presentation viewer for customer meetings
- **Photo Upload**: Quick job site photo capture and upload
- **5 Request Types**:
  - Custom Pricing Requests (with voice support)
  - New Builder/Community submissions
  - Installation Issue reports
  - Material Requests
  - Customer Escalations

### Operations Dashboard
- Request queue management
- Team analytics
- Real-time notifications
- Response tracking

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deployment**: Netlify
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Netlify account (for deployment)

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/GiacomoIaco/discount-fence-hub.git
cd discount-fence-hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in the Supabase SQL Editor
3. Create the following storage buckets in Supabase:
   - `voice-recordings` - for audio files
   - `photos` - for job site photos
   - `presentations` - for client presentation files

4. Set up storage policies (in Supabase Dashboard > Storage > Policies):
   ```sql
   -- Example policy for photos bucket
   CREATE POLICY "Users can upload photos"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'photos' AND auth.uid() = owner);
   ```

### 4. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see the app.

### 6. Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

## 🚀 Deployment

### Deploy to Netlify

1. Push your code to GitHub
2. Connect your repo to Netlify
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

**Or use Netlify CLI:**

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

## 📁 Project Structure

```
discount-fence-hub/
├── src/
│   ├── components/
│   │   ├── sales/
│   │   │   └── StainCalculator.tsx
│   │   ├── operations/
│   │   └── shared/
│   ├── hooks/
│   ├── lib/
│   │   └── supabase.ts
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── supabase-schema.sql
├── netlify.toml
├── .env.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🔐 Authentication

The app uses Supabase Auth. Users must be authenticated to access the application. Configure auth providers in your Supabase dashboard.

## 📊 Database Schema

### Tables
- `sales_reps` - User profiles for sales reps
- `requests` - All request submissions (pricing, issues, etc.)
- `presentations` - Client presentation files
- `roi_calculations` - Pre-stain calculator usage tracking
- `activity_log` - Audit trail

See `supabase-schema.sql` for complete schema and RLS policies.

## 🎤 Voice Features (Future Enhancement)

Currently uses simulated AI parsing. To enable real voice-to-text:

1. Add OpenAI Whisper API integration for transcription
2. Add Claude API for intelligent parsing
3. Update `.env` with API keys:
   ```env
   VITE_OPENAI_API_KEY=your_key
   VITE_ANTHROPIC_API_KEY=your_key
   ```

## 🛣️ Roadmap

- [ ] Implement real Whisper + Claude API integration
- [ ] Add push notifications
- [ ] Offline mode with service workers
- [ ] Photo compression before upload
- [ ] Export reports to PDF
- [ ] Team chat/messaging
- [ ] Mobile app (React Native)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software owned by Discount Fence USA.

## 👥 Team

- **Developer**: GiacomoIaco
- **Company**: Discount Fence USA

## 📧 Support

For issues or questions, contact your development team or create an issue in the GitHub repository.

---

**Built with ❤️ for Discount Fence USA**
