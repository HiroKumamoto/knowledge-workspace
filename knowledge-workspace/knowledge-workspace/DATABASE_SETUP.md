# Database Setup Instructions

## 1. Supabase Account Setup
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Copy your project URL and anon key from Settings > API

https://mvdpunvuixtvjscuqkzk.supabase.co
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZHB1bnZ1aXh0dmpzY3Vxa3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTc2OTMsImV4cCI6MjA3MjM3MzY5M30.Cgd0CRFau2i4S0dbINWWC4jSm_Ztt2A8sXKCfZrNWgE

e6e%dJtmrLgf.?G

## 2. Environment Variables
Update `.env.local` with your actual Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://mvdpunvuixtvjscuqkzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZHB1bnZ1aXh0dmpzY3Vxa3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTc2OTMsImV4cCI6MjA3MjM3MzY5M30.Cgd0CRFau2i4S0dbINWWC4jSm_Ztt2A8sXKCfZrNWgE
```

## 3. Database Schema
Run these SQL commands in your Supabase SQL Editor:

```sql
-- Create projects table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex')
);

-- Create notes table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required)
CREATE POLICY "Allow public read access on projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on projects" ON projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on projects" ON projects
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on projects" ON projects
  FOR DELETE USING (true);

CREATE POLICY "Allow public read access on notes" ON notes
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on notes" ON notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on notes" ON notes
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on notes" ON notes
  FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_notes_project_id ON notes(project_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX idx_projects_share_token ON projects(share_token);
```

## 4. Setup Storage for Images
Create a storage bucket for images:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `images`
3. Make it public (for easy access to uploaded images)
4. Or run this SQL to create the bucket and policy:

```sql
-- Create storage bucket for images (skip if already exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies (will be ignored if they already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload images') THEN
    CREATE POLICY "Anyone can upload images" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'images');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view images') THEN
    CREATE POLICY "Anyone can view images" ON storage.objects
      FOR SELECT USING (bucket_id = 'images');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update images') THEN
    CREATE POLICY "Anyone can update images" ON storage.objects
      FOR UPDATE USING (bucket_id = 'images');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can delete images') THEN
    CREATE POLICY "Anyone can delete images" ON storage.objects
      FOR DELETE USING (bucket_id = 'images');
  END IF;
END $$;
```

## 5. Test the setup
After running the SQL and updating your env vars, restart your Next.js dev server.