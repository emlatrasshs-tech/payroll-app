import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://nixhrxwlbxetjvmniqcp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peGhyeHdsYnhldGp2bW5pcWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDU1NjEsImV4cCI6MjA5MTU4MTU2MX0.4Z-pZm82QgY2DX3s59Ak8pxRqjOWHhy0A3jS1jjfQ5A'
)
