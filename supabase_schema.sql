-- =============================================
-- WaveChat - Supabase Schema (Phase 1)
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  status_text text default 'Hey there! I am using WaveChat 👋',
  phone_number text,
  is_online boolean default false,
  last_seen timestamptz default now(),
  privacy_last_seen text default 'everyone' check (privacy_last_seen in ('everyone', 'contacts', 'nobody')),
  privacy_profile_photo text default 'everyone' check (privacy_profile_photo in ('everyone', 'contacts', 'nobody')),
  notifications_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- CONVERSATIONS TABLE
-- =============================================
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  name text,
  is_group boolean default false,
  group_avatar_url text,
  group_description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;
create policy "Users can view conversations they are members of"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = id and user_id = auth.uid()
    )
  );
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() is not null);

-- =============================================
-- CONVERSATION MEMBERS TABLE
-- =============================================
create table if not exists public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('member', 'admin')),
  pinned boolean default false,
  muted boolean default false,
  last_read_at timestamptz default now(),
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

alter table public.conversation_members enable row level security;
create policy "Members can view conversation memberships"
  on public.conversation_members for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.conversation_members cm2
      where cm2.conversation_id = conversation_id and cm2.user_id = auth.uid()
    )
  );
create policy "Authenticated users can insert members"
  on public.conversation_members for insert
  with check (auth.uid() is not null);
create policy "Users can update own membership"
  on public.conversation_members for update
  using (user_id = auth.uid());
create policy "Users can delete own membership"
  on public.conversation_members for delete
  using (user_id = auth.uid());

-- =============================================
-- MESSAGES TABLE
-- =============================================
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  content text,
  message_type text default 'text' check (message_type in ('text', 'image', 'voice', 'document', 'system')),
  media_url text,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded_from uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;
create policy "Members can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );
create policy "Members can insert messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );
create policy "Senders can update own messages"
  on public.messages for update
  using (sender_id = auth.uid());

-- =============================================
-- MESSAGE REACTIONS TABLE
-- =============================================
create table if not exists public.message_reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;
create policy "Anyone in conversation can see reactions"
  on public.message_reactions for select using (true);
create policy "Users can add reactions"
  on public.message_reactions for insert
  with check (auth.uid() = user_id);
create policy "Users can delete own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

-- =============================================
-- BLOCKED USERS TABLE
-- =============================================
create table if not exists public.blocked_users (
  id uuid default uuid_generate_v4() primary key,
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;
create policy "Users can manage own blocks"
  on public.blocked_users for all
  using (auth.uid() = blocker_id);

-- =============================================
-- STORAGE BUCKETS
-- =============================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('chat-media', 'chat-media', false) on conflict do nothing;

-- Storage policies
create policy "Avatar images are publicly accessible"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Chat members can view media"
  on storage.objects for select
  using (bucket_id = 'chat-media' and auth.uid() is not null);
create policy "Authenticated users can upload chat media"
  on storage.objects for insert
  with check (bucket_id = 'chat-media' and auth.uid() is not null);

-- =============================================
-- REALTIME ENABLE
-- =============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.profiles;
