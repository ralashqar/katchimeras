insert into public.todos (name)
values
  ('Set up Supabase'),
  ('Ship the onboarding flow'),
  ('Polish the iPhone UI')
on conflict do nothing;
