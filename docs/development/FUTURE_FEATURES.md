# Future Features & Discussed Enhancements

This document tracks features and functionalities that have been discussed but are not yet implemented in the Discount Fence USA Operations Hub.

---

## 📋 Team Communication - Status Update

**Current Status**: Internal team announcements system is COMPLETE ✅ (see TEAM_COMMUNICATION_UPDATES.md)

### Recent Completions (October 12, 2025)
- ✅ Unified communication interface (Announcements Management + View)
- ✅ Survey.js integration for multi-question surveys
- ✅ Stats column alignment fixed (right-aligned approach)
- ✅ Survey response tracking (JSON + legacy format support)
- ✅ Engagement tracking (opened, acknowledged, responded)
- ✅ Draft system for announcements
- ✅ Comment system
- ✅ Archive functionality

---

## 🎯 CLIENT SURVEY SYSTEM - NEW PRIORITY 🔨

### **External Client Surveys** (HIGH PRIORITY - NOT STARTED)
**Purpose**: Survey external clients/customers (separate from internal team announcements)

**Key Differences from Team Announcements**:
- Public access (no login required)
- Anonymous responses (optional)
- Custom public URLs (e.g., `/survey/customer-satisfaction-2025`)
- Multi-page surveys (unlike single-page team announcements)
- Email distribution with tracking
- IP-based duplicate prevention

**Features Needed**:
1. **Survey Builder for Clients**
   - Re-use Survey.js but with multi-page enabled
   - Question logic/branching (show Q3 if Q2 = "Yes")
   - Required vs optional questions
   - Custom themes/branding
   - Survey templates library

2. **Public Survey Interface**
   - No authentication required
   - Progress indicator for multi-page
   - Save and continue later (cookie-based)
   - Mobile-responsive
   - Thank you page with custom message

3. **Distribution & Tracking**
   - Generate unique public URLs
   - QR code generation for in-person distribution
   - Email sending with tracking (opens, clicks)
   - UTM parameter support for campaign tracking
   - Response quotas (e.g., stop after 100 responses)

4. **Admin Dashboard**
   - List all client surveys
   - Create/edit/duplicate surveys
   - View response counts
   - Pause/resume surveys
   - Set expiration dates
   - Export responses to CSV

5. **Response Analytics**
   - Real-time response tracking
   - Response rate by distribution channel
   - Completion rate (started vs finished)
   - Time to complete average
   - Question skip rates
   - Text analysis for open-ended questions

**Database Schema**:
```sql
-- Client surveys (public, no auth required)
CREATE TABLE client_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  survey_json JSONB NOT NULL,  -- Survey.js definition
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  max_responses INTEGER,  -- NULL = unlimited
  allow_multiple_responses BOOLEAN DEFAULT false,
  anonymous BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',  -- active, paused, closed
  public_url_slug TEXT UNIQUE NOT NULL,
  thank_you_message TEXT,
  redirect_url TEXT,  -- Redirect after completion
  theme_settings JSONB  -- Colors, logo, etc.
);

-- Client survey responses
CREATE TABLE client_survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID REFERENCES client_surveys(id) ON DELETE CASCADE,
  response_data JSONB NOT NULL,  -- Survey.js complete response
  submitted_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  time_to_complete INTEGER,  -- Seconds
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT,  -- For tracking partial responses
  completed BOOLEAN DEFAULT true,
  metadata JSONB  -- Additional tracking data
);

-- Email distribution tracking
CREATE TABLE client_survey_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID REFERENCES client_surveys(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  responded_at TIMESTAMP,
  tracking_code TEXT UNIQUE NOT NULL
);

-- Create indexes
CREATE INDEX idx_client_surveys_status ON client_surveys(status);
CREATE INDEX idx_client_surveys_slug ON client_surveys(public_url_slug);
CREATE INDEX idx_client_responses_survey ON client_survey_responses(survey_id);
CREATE INDEX idx_client_responses_ip ON client_survey_responses(ip_address);
CREATE INDEX idx_client_emails_survey ON client_survey_emails(survey_id);
CREATE INDEX idx_client_emails_tracking ON client_survey_emails(tracking_code);
```

**Components Needed**:
- `ClientSurveyBuilder.tsx` - Create/edit client surveys (re-use SimpleSurveyBuilder)
- `ClientSurveyDashboard.tsx` - List all client surveys, stats overview
- `PublicSurveyView.tsx` - Public-facing survey taking interface (no auth)
- `ClientSurveyResults.tsx` - View responses and analytics
- `SurveyEmailSender.tsx` - Send survey invitations via email
- `SurveyQRCode.tsx` - Generate QR codes for surveys

**Routing Changes**:
```typescript
// Add to App.tsx routing
<Route path="/survey/:slug" element={<PublicSurveyView />} />
<Route path="/survey/:slug/thank-you" element={<ThankYouPage />} />

// Admin routes (authenticated)
<Route path="/admin/client-surveys" element={<ClientSurveyDashboard />} />
<Route path="/admin/client-surveys/new" element={<ClientSurveyBuilder />} />
<Route path="/admin/client-surveys/:id/edit" element={<ClientSurveyBuilder />} />
<Route path="/admin/client-surveys/:id/results" element={<ClientSurveyResults />} />
```

**Netlify Functions Needed**:
- `submit-client-survey.ts` - Handle public survey submissions
- `send-survey-emails.ts` - Batch email sending
- `track-survey-email.ts` - Track email opens/clicks

**Features vs Team Announcements**:

| Feature | Team Announcements | Client Surveys |
|---------|-------------------|----------------|
| Authentication | Required (Supabase Auth) | None (public) |
| Multi-page | No (single page) | Yes (full support) |
| Target audience | Internal team | External clients |
| Distribution | In-app only | Email + URL + QR code |
| Response tracking | By user ID | By IP/cookie/email |
| Results visibility | Admin only | Optional (show after submit) |
| Branding | Fixed app theme | Custom themes |
| Anonymity | Named responses | Anonymous option |

**Use Cases**:
1. Customer satisfaction surveys after fence installation
2. Product feedback collection
3. Market research for new products/services
4. Event feedback forms
5. Lead generation questionnaires
6. Post-sales follow-up surveys
7. Referral source tracking

**Estimated Effort**: 16-20 hours
- Database schema: 1-2 hours
- Survey builder UI: 3-4 hours
- Public survey view: 3-4 hours
- Response submission & storage: 2-3 hours
- Admin dashboard: 3-4 hours
- Results analytics: 2-3 hours
- Email distribution: 2-3 hours

**Priority**: HIGH (provides customer feedback loop)

**Dependencies**:
- ✅ Survey.js already integrated
- ✅ Supabase database ready
- ❌ Email service setup (Netlify functions + SMTP or SendGrid)
- ❌ Public route handling (currently all routes require auth)

---

## 📋 Team Communication - Remaining Enhancements

### Phase 3: Analytics & Engagement 🔨 NOT STARTED

#### 1. **Message Engagement Dashboard**
**Status**: Discussed, not implemented
**Purpose**: Allow message creators to see who has/hasn't responded

**Features**:
- Overall engagement statistics display
  - Opened count/percentage
  - Acknowledged count/percentage
  - Responded count/percentage
- List of users who haven't responded yet
- "Send Reminder" button to nudge non-responders
- Export engagement data to CSV
- Filter by role, date range
- Visual progress indicators

**UI Mockup**:
```
┌─────────────────────────────┐
│  Safety Training Required   │
│  📊 15 recipients            │
├─────────────────────────────┤
│  ✓ Opened: 12/15 (80%)      │
│  ✓ Acked:   8/15 (53%)      │
│                             │
│  ⚠️ Not acknowledged:        │
│  • John Smith               │
│  • Sarah Johnson            │
│  • Mike Davis               │
│                             │
│  [Send Reminder] [Export]   │
└─────────────────────────────┘
```

**Implementation Notes**:
- Use existing `message_engagement` table
- Query for users without engagement records
- Create reminder notification system
- CSV export with timestamp, user, status

---

#### 2. **Survey Results Export to CSV**
**Status**: UI complete, export logic pending
**Component**: `SurveyResults.tsx` has export button, missing actual export function

**Features to Add**:
- Export button triggers CSV download
- Include question text and all answers
- Separate columns for each question
- Include respondent names (unless anonymous)
- Timestamp for each response
- Summary statistics at top

**CSV Format**:
```csv
Survey: Training Feedback
Total Responses: 12
Export Date: 2024-10-05

Question,Response,Respondent,Date
"How was the training?","Excellent","John Smith","2024-10-04"
"How was the training?","Good","Jane Doe","2024-10-04"
"What would you improve?","More hands-on examples","John Smith","2024-10-04"
```

---

#### 3. **Team Communication Integration in Mobile View**
**Status**: Survey components built, not integrated into TeamCommunicationMobileV2

**Missing Integrations**:
1. **Survey Response in Message Cards**:
   - When user opens survey message, show `SurveyResponse` component
   - Submit answers via API
   - Update message_state to 'answered'
   - Track response in message_engagement table

2. **Survey Results Viewing**:
   - "View Results" button on sent surveys (for creators)
   - Opens `SurveyResults` component in modal
   - Show real-time response count
   - Update when new responses come in

3. **Message Detail View**:
   - Full-screen message view for long content
   - Survey questions display
   - Results preview (if allowed by creator)
   - Edit responses (if allowed)

**Components Ready**:
- ✅ `SurveyBuilder.tsx` - Create questions
- ✅ `SurveyResponse.tsx` - Answer questions
- ✅ `SurveyResults.tsx` - View analytics
- ❌ Integration code in `TeamCommunicationMobileV2.tsx`

---

### Phase 4: Polish & UX 🔨 NOT STARTED

#### 4. **Swipe Gestures**
**Status**: Discussed, not implemented
**Platform**: Mobile only

**Features**:
- Swipe right on message → Archive
- Swipe left on message → Pin to top
- Visual feedback during swipe (icon appears)
- Undo option after swipe action
- Haptic feedback on mobile devices

**Libraries to Consider**:
- `react-swipeable` or `framer-motion`
- Native touch events with threshold detection

---

#### 5. **Pull-to-Refresh**
**Status**: Discussed, not implemented

**Features**:
- Pull down on message list → Refresh data
- Animated refresh indicator
- Fetch latest messages from server
- Update unread counts
- Works on both Inbox and Sent tabs

---

#### 6. **Push Notifications Integration**
**Status**: Discussed, needs backend setup

**Features**:
- Browser push notifications for new messages
- In-app notification badge
- Notification preferences per message type
- "Mark as read" from notification
- Deep link to specific message

**Requirements**:
- Service worker registration (already done for PWA)
- Notification permission prompt
- Backend notification service (Supabase Realtime or custom)
- Notification payload structure

---

## 🎨 UI/UX Enhancements Discussed

### 1. **Enhanced Message Composer**
**Current State**: Basic composer works, missing advanced features

**Discussed Enhancements**:
- [ ] Schedule send (date/time picker)
- [ ] Target specific users (not just roles)
- [ ] Attach files to messages
- [ ] Rich text editor for content (bold, italic, lists)
- [ ] Message templates library
- [ ] Preview before sending
- [ ] Auto-save drafts every 30 seconds
- [ ] Duplicate message (copy settings)

---

### 2. **Message Threading/Replies**
**Status**: Not discussed in detail, but logical next step

**Potential Features**:
- Reply to specific messages
- Thread view for conversations
- Quote original message in reply
- Notification when someone replies to your message

---

### 3. **Message Categories/Tags**
**Status**: Beyond current message types

**Ideas**:
- Custom tags (Urgent, FYI, Action Required)
- Color-coded categories
- Filter by multiple tags
- Tag-based permissions

---

## 🔧 Technical Improvements Needed

### 1. **Real-time Updates**
**Status**: Not implemented

**Features Needed**:
- Supabase Realtime subscriptions for new messages
- Auto-update message list when new message arrives
- Live unread count updates
- Toast notification for new messages
- Optimistic UI updates

**Implementation**:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'company_messages'
    }, (payload) => {
      // Add new message to state
      // Update unread count
      // Show notification
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

---

### 2. **Message Search**
**Status**: Not implemented

**Features**:
- Full-text search across message titles and content
- Filter results by type, date, sender
- Search in survey questions and responses
- Highlight search terms in results

---

### 3. **Batch Operations**
**Status**: Not discussed

**Potential Features**:
- Select multiple messages
- Bulk archive
- Bulk mark as read
- Bulk delete (drafts only)

---

## 📊 Analytics & Reporting

### 1. **Message Analytics Dashboard**
**Status**: Not implemented

**Metrics to Track**:
- Messages sent per day/week/month
- Average response time
- Response rate by message type
- Most engaged users
- Peak messaging times
- Survey completion rates
- Acknowledgment compliance rates

---

### 2. **User Activity Reports**
**Status**: Not implemented

**Reports Needed**:
- Individual user engagement history
- Team communication patterns
- Department-level statistics
- Manager effectiveness metrics

---

## 👤 Advanced User Profile Features

### 1. **Enhanced User Profile**
**Status**: Discussed, not implemented (basic profile exists with avatar_url field)

**Current State**:
- ✅ Basic profile with: full_name, email, role, phone, avatar_url
- ❌ No profile picture upload
- ❌ No "About Me" bio
- ❌ No voice sample storage

**Features to Implement**:

#### A. Profile Picture Upload
- Upload profile photo (max 5MB)
- Auto-resize to 300x300px thumbnail
- Store in Supabase Storage bucket `user-avatars`
- Update `avatar_url` in user_profiles table
- Default avatar with initials if no photo
- Crop/rotate functionality before upload

#### B. About Me / Bio Section
- Add `bio` TEXT column to user_profiles table
- Character limit: 500 characters
- Rich text editor for formatting
- Display in team directory
- Show on hover in message threads
- Visibility settings (team only, managers, public)

#### C. Voice Sample for AI Sales Coach
**Purpose**: Allow AI to learn each rep's voice for personalized coaching

**Implementation**:
- Add `voice_sample_url` TEXT column to user_profiles table
- Record 30-60 second voice sample during onboarding
- Store in Supabase Storage bucket `voice-samples`
- Use for:
  - Voice verification in recordings
  - Personalized speech pattern analysis
  - Coaching on speaking pace, tone, clarity
  - Benchmark for improvement tracking

**Voice Sample Collection Flow**:
1. Prompt user: "Read this script to help our AI learn your voice"
2. Provide sample script (30-60 seconds)
3. Record audio using MediaRecorder API
4. Upload to storage
5. Optional: Transcribe and validate recording quality
6. Save reference in user profile

**AI Integration**:
- Pass voice sample to AI analysis for comparison
- "This rep tends to speak 20% faster than their baseline"
- Emotion/tone analysis calibrated to individual
- Track vocal improvement over time

#### D. Additional Profile Fields to Consider
- `territory` - Geographic area assignment
- `start_date` - Employment start date
- `certifications` - List of completed trainings
- `goals` - Personal sales goals
- `achievements` - Badges/awards earned
- `preferences` - Notification settings, theme, language

**Database Schema Update Needed**:
```sql
ALTER TABLE user_profiles
ADD COLUMN bio TEXT,
ADD COLUMN voice_sample_url TEXT,
ADD COLUMN territory TEXT,
ADD COLUMN start_date DATE,
ADD COLUMN certifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN goals JSONB DEFAULT '{}'::jsonb,
ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
```

**Storage Buckets Needed**:
- `user-avatars` - Profile pictures
- `voice-samples` - Voice baseline recordings

**UI Components Needed**:
- `UserProfileEditor.tsx` - Edit profile form
- `ProfilePictureUpload.tsx` - Image upload with crop
- `VoiceSampleRecorder.tsx` - Voice sample collection
- `UserProfileView.tsx` - Public profile display
- `TeamDirectory.tsx` - Browse all team members

**Estimated Effort**: 8-12 hours
- Database schema: 1 hour
- Storage setup: 1 hour
- Profile picture upload: 2-3 hours
- Bio editor: 1-2 hours
- Voice sample recorder: 3-4 hours
- Profile view components: 2-3 hours

**Priority**: Medium-High (voice sample important for AI coaching accuracy)

---

## 🔐 Security & Permissions

### 1. **Advanced Permissions**
**Status**: Basic role permissions implemented

**Enhancements Discussed**:
- Custom permission levels per user
- Message visibility rules (department-specific)
- Draft sharing between admins
- Delegate message sending rights
- Audit log for message actions

---

### 2. **Message Expiration & Auto-Delete**
**Status**: Expiration date field exists, auto-delete not implemented

**Features to Add**:
- Scheduled job to delete expired messages
- Warning before expiration (3 days, 1 day)
- Archive before delete option
- Permanent delete vs soft delete

---

## 📱 Mobile-Specific Features

### 1. **Offline Message Composition**
**Status**: Not implemented

**Features**:
- Compose messages offline
- Queue for sending when online
- Draft sync across devices
- Conflict resolution

---

### 2. **Voice-to-Text Message Input**
**Status**: Not implemented (voice recording exists for other features)

**Features**:
- Record voice message as content
- Transcribe to text automatically
- Edit transcription before sending
- Attach audio file option

---

## 🔄 Integration Features

### 1. **Email Notifications**
**Status**: Not implemented

**Triggers**:
- New message received
- Survey deadline approaching
- Response required reminder
- Daily digest of unread messages

**Implementation Needed**:
- Netlify function for email sending
- Email templates
- User email preferences
- Unsubscribe management

---

### 2. **Calendar Integration**
**Status**: Not implemented

**For Event Messages**:
- Add event to Google Calendar / Outlook
- RSVP integration
- Automatic reminders
- Location/meeting link in calendar

---

### 3. **Slack/Teams Integration**
**Status**: Not implemented

**Features**:
- Mirror messages to Slack/Teams channel
- Reply from Slack appears in app
- Notification preferences
- Two-way sync

---

## 🎯 Priority Recommendations

### High Priority (Next Sprint):
1. ✅ Survey system integration into TeamCommunicationMobileV2 (components ready)
2. ✅ CSV export for survey results (button exists, needs implementation)
3. 🔨 Engagement dashboard (who hasn't responded)
4. 🔨 Real-time updates with Supabase Realtime

### Medium Priority (Future Sprints):
5. **Enhanced User Profiles** (profile pic, bio, voice sample) - Important for AI coaching
6. Message search functionality
7. Swipe gestures for mobile
8. Email notifications for messages
9. Schedule message sending
10. Advanced user targeting (specific users, not just roles)

### Low Priority (Future Enhancements):
10. Message threading/replies
11. Voice-to-text composition
12. Batch operations
13. Analytics dashboard
14. Slack/Teams integration

---

## 📝 Implementation Status Summary

| Feature Category | Status | Components Ready | Backend Ready | Estimated Effort |
|-----------------|--------|------------------|---------------|------------------|
| Survey System Integration | 🔨 Partial | ✅ Yes | ✅ Yes | 2-4 hours |
| Engagement Dashboard | ❌ Not Started | ❌ No | ✅ Yes (data exists) | 4-6 hours |
| CSV Export | ❌ Not Started | ✅ Yes (button) | ❌ No | 2-3 hours |
| Enhanced User Profile | ❌ Not Started | ❌ No | ⚠️ Partial (avatar_url) | 8-12 hours |
| Voice Sample Collection | ❌ Not Started | ⚠️ Partial (MediaRecorder) | ❌ No | 3-4 hours |
| Real-time Updates | ❌ Not Started | ❌ No | ⚠️ Setup needed | 4-6 hours |
| Swipe Gestures | ❌ Not Started | ❌ No | ✅ Yes | 3-4 hours |
| Push Notifications | ❌ Not Started | ⚠️ Partial (PWA) | ❌ No | 6-8 hours |
| Message Search | ❌ Not Started | ❌ No | ⚠️ Partial | 4-6 hours |
| Email Integration | ❌ Not Started | ❌ No | ❌ No | 6-8 hours |

---

## 🚀 Quick Wins (Can Implement Quickly)

1. **CSV Export** (2-3 hours)
   - Function exists in SurveyResults.tsx
   - Just needs CSV generation logic
   - Use `json2csv` or similar library

2. **Survey Response Integration** (2-4 hours)
   - Components already built
   - Just wire up to TeamCommunicationMobileV2
   - Add submit handler to save responses

3. **Swipe to Archive** (3-4 hours)
   - Add react-swipeable library
   - Implement swipe handler
   - Call existing archive function

---

**Last Updated**: October 5, 2024
**Maintained By**: Development Team
**Status**: Living document - update as features are discussed/implemented
