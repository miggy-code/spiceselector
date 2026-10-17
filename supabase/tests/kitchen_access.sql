-- Run against a development database. All fixtures and changes roll back.
begin;
insert into auth.users(id, email) values
 ('dd000000-0000-4000-8000-000000000001', 'kitchen-rls-a@example.invalid'),
 ('dd000000-0000-4000-8000-000000000002', 'kitchen-rls-b@example.invalid');
insert into public.recipes(user_id, title) values
 ('dd000000-0000-4000-8000-000000000001', 'RLS fixture A'),
 ('dd000000-0000-4000-8000-000000000002', 'RLS fixture B');
insert into public.saved_blends(id, user_id, name, slugs) values
 ('kitchen-fixture-a', 'dd000000-0000-4000-8000-000000000001', 'A', array['cumin']),
 ('kitchen-fixture-b', 'dd000000-0000-4000-8000-000000000002', 'B', array['paprika']);
insert into public.spice_racks(user_id, slugs) values
 ('dd000000-0000-4000-8000-000000000002', array['paprika']);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dd000000-0000-4000-8000-000000000001', true);
do $$ begin
 if (select count(*) from public.recipes) <> 1 then raise exception 'Recipe isolation failed'; end if;
 if (select count(*) from public.saved_blends) <> 1 then raise exception 'Blend isolation failed'; end if;
 if (select count(*) from public.spice_racks) <> 0 then raise exception 'Rack isolation failed'; end if;
 update public.recipes set title = 'changed' where user_id = 'dd000000-0000-4000-8000-000000000002';
 if found then raise exception 'Cross-user update permitted'; end if;
 delete from public.saved_blends where id = 'kitchen-fixture-b';
 if found then raise exception 'Cross-user deletion permitted'; end if;
 begin
  insert into public.recipes(user_id, title) values ('dd000000-0000-4000-8000-000000000002', 'invalid');
  raise exception 'Cross-user insert permitted';
 exception when insufficient_privilege then null; end;
 perform public.toggle_rack_spice('cumin');
 perform public.toggle_rack_spice('cumin');
 if (select cardinality(slugs) from public.spice_racks) <> 0 then raise exception 'Rack toggle failed'; end if;
 perform public.merge_rack_spices(array['cumin', 'paprika', 'cumin']);
 if (select cardinality(slugs) from public.spice_racks) <> 2 then raise exception 'Rack merge failed'; end if;
end $$;
reset role;
rollback;
