create function public.merge_rack_spices(spice_slugs text[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if spice_slugs is null or cardinality(spice_slugs) > 73 or exists (select 1 from unnest(spice_slugs) s where s is null or char_length(s) not between 1 and 100) then raise exception 'Invalid spices'; end if;
 insert into public.spice_racks(user_id) values (auth.uid()) on conflict (user_id) do nothing;
 update public.spice_racks r set slugs = array(select distinct s from unnest(r.slugs || spice_slugs) s order by s) where r.user_id = auth.uid();
end;
$$;
revoke all on function public.merge_rack_spices(text[]) from public, anon;
grant execute on function public.merge_rack_spices(text[]) to authenticated;
