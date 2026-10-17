create function public.toggle_rack_spice(spice_slug text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if spice_slug is null or char_length(spice_slug) not between 1 and 100 then raise exception 'Invalid spice'; end if;
 insert into public.spice_racks(user_id) values (auth.uid()) on conflict (user_id) do nothing;
 update public.spice_racks set slugs = case when spice_slug = any(slugs) then array_remove(slugs, spice_slug) else array_append(slugs, spice_slug) end where user_id = auth.uid();
end;
$$;
revoke all on function public.toggle_rack_spice(text) from public, anon;
grant execute on function public.toggle_rack_spice(text) to authenticated;
