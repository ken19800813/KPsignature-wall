const SUPABASE_URL = 'https://khfdeygyhjvmvljztiwg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZmRleWd5aGp2bXZsanp0aXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTc0MDUsImV4cCI6MjA5MTg5MzQwNX0._RBk5rhBeDHyK7TpSe-vvGmwYXd3gKY5IJL89z8_kYc';

// Create Supabase client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
