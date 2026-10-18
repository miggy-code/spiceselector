-- The catalog uses the existing taxonomy dot IDs as stable identifiers.  The
-- source JSON remains the import input; this schema is the runtime authority.
create table public.catalog_taxonomy_nodes (
  id text primary key check (id ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'),
  parent_id text references public.catalog_taxonomy_nodes(id) on delete restrict,
  name text not null check (char_length(btrim(name)) > 0),
  level text not null check (level in ('root', 'family', 'subcategory', 'spice')),
  color text,
  description text,
  position smallint not null check (position >= 0),
  unique (parent_id, position)
);
create index catalog_taxonomy_nodes_parent_position_idx on public.catalog_taxonomy_nodes(parent_id, position);

create table public.catalog_spices (
  id text primary key references public.catalog_taxonomy_nodes(id) on delete restrict,
  source_key text not null unique,
  slug text not null unique,
  source_position smallint not null unique check (source_position >= 0),
  name text not null,
  family text not null,
  -- Non-runtime provenance fields retained losslessly from generated profiles.
  extra_metadata jsonb not null default '{}'::jsonb,
  botanical_name text,
  botanical_family text,
  origin text,
  description text,
  warmth numeric not null check (warmth between 0 and 100),
  brightness numeric not null check (brightness between 0 and 100),
  earthiness numeric not null check (earthiness between 0 and 100),
  florality numeric not null check (florality between 0 and 100),
  heat numeric not null check (heat between 0 and 100),
  intensity numeric not null check (intensity between 0 and 100),
  commonality numeric not null check (commonality between 0 and 100),
  heat_level text,
  atlas_x numeric,
  atlas_y numeric
);
create index catalog_spices_slug_idx on public.catalog_spices(slug);

create table public.catalog_spice_aliases (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  alias text not null,
  position smallint not null check (position >= 0),
  primary key (spice_id, alias), unique (spice_id, position)
);
create table public.catalog_spice_subfamilies (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  subfamily text not null,
  position smallint not null check (position >= 0),
  primary key (spice_id, subfamily), unique (spice_id, position)
);
create table public.catalog_spice_profile_cuisines (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  cuisine text not null,
  frequency text not null,
  typical_quantity text,
  position smallint not null check (position >= 0),
  primary key (spice_id, cuisine), unique (spice_id, position)
);
create table public.catalog_spice_key_compounds (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  name text not null,
  role text not null,
  position smallint not null check (position >= 0),
  primary key (spice_id, position)
);
create table public.catalog_spice_substitute_hints (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  substitute text not null,
  similarity numeric,
  notes text,
  position smallint not null check (position >= 0),
  primary key (spice_id, position)
);
create table public.catalog_spice_pairing_hints (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  paired_spice text not null,
  affinity text not null check (affinity in ('classic', 'complementary', 'surprising')),
  note text,
  cuisines_present boolean not null default false,
  position smallint not null check (position >= 0),
  primary key (spice_id, position)
);
create table public.catalog_spice_pairing_hint_cuisines (
  spice_id text not null,
  hint_position smallint not null,
  cuisine text not null,
  position smallint not null check (position >= 0),
  primary key (spice_id, hint_position, cuisine), unique (spice_id, hint_position, position),
  foreign key (spice_id, hint_position) references public.catalog_spice_pairing_hints(spice_id, position) on delete cascade
);

create table public.catalog_classic_blends (
  id text primary key,
  source_position smallint not null unique check (source_position >= 0),
  name text not null,
  origin text not null,
  description text not null
);
create table public.catalog_classic_blend_spices (
  blend_id text not null references public.catalog_classic_blends(id) on delete cascade,
  spice_id text not null references public.catalog_spices(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (blend_id, spice_id), unique (blend_id, position)
);
create index catalog_classic_blend_spices_spice_idx on public.catalog_classic_blend_spices(spice_id);

create table public.catalog_curated_pairings (
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  paired_spice_id text not null references public.catalog_spices(id) on delete cascade,
  source_position smallint not null check (source_position >= 0),
  affinity text not null check (affinity in ('classic', 'complementary', 'surprising')),
  note text,
  cuisines_present boolean not null default false,
  primary key (spice_id, paired_spice_id), unique (spice_id, source_position), check (spice_id <> paired_spice_id)
);
create table public.catalog_curated_pairing_entries (
  spice_id text primary key references public.catalog_spices(id) on delete cascade,
  source_position smallint not null unique check (source_position >= 0)
);
create index catalog_curated_pairings_target_idx on public.catalog_curated_pairings(paired_spice_id);
create table public.catalog_curated_pairing_cuisines (
  spice_id text not null,
  paired_spice_id text not null,
  cuisine text not null,
  position smallint not null check (position >= 0),
  primary key (spice_id, paired_spice_id, cuisine), unique(spice_id, paired_spice_id, position),
  foreign key (spice_id, paired_spice_id) references public.catalog_curated_pairings(spice_id, paired_spice_id) on delete cascade
);

create table public.catalog_flavor_affinities (
  spice_a_id text not null references public.catalog_spices(id) on delete cascade,
  spice_b_id text not null references public.catalog_spices(id) on delete cascade,
  source_a_id text not null references public.catalog_spices(id) on delete restrict,
  source_b_id text not null references public.catalog_spices(id) on delete restrict,
  source_position integer not null unique check (source_position >= 0),
  score numeric not null check (score between 0 and 1),
  primary key (spice_a_id, spice_b_id), check (spice_a_id < spice_b_id), check (source_a_id <> source_b_id)
);
create index catalog_flavor_affinities_b_idx on public.catalog_flavor_affinities(spice_b_id);
create table public.catalog_compound_pair_evidence (
  spice_a_id text not null references public.catalog_spices(id) on delete cascade,
  spice_b_id text not null references public.catalog_spices(id) on delete cascade,
  source_a_id text not null references public.catalog_spices(id) on delete restrict,
  source_b_id text not null references public.catalog_spices(id) on delete restrict,
  source_position integer not null unique check (source_position >= 0),
  shared_count integer not null check (shared_count >= 0),
  shared_aroma_count integer not null check (shared_aroma_count >= 0),
  jaccard numeric not null check (jaccard between 0 and 1),
  flavordb2_score numeric check (flavordb2_score between 0 and 1),
  flavordb2_shared_count integer check (flavordb2_shared_count >= 0),
  compound_score numeric not null check (compound_score between 0 and 1),
  primary key (spice_a_id, spice_b_id), check (spice_a_id < spice_b_id)
);
create table public.catalog_compound_pair_sources (
  spice_a_id text not null, spice_b_id text not null,
  source text not null check (source in ('foodb_usda', 'flavordb2')),
  position smallint not null check (position >= 0),
  primary key (spice_a_id, spice_b_id, source),
  foreign key (spice_a_id, spice_b_id) references public.catalog_compound_pair_evidence(spice_a_id, spice_b_id) on delete cascade
);
create table public.catalog_compound_pair_shared_compounds (
  spice_a_id text not null, spice_b_id text not null,
  name text not null, position smallint not null check (position >= 0),
  primary key (spice_a_id, spice_b_id, position),
  foreign key (spice_a_id, spice_b_id) references public.catalog_compound_pair_evidence(spice_a_id, spice_b_id) on delete cascade
);
create table public.catalog_compound_pair_shared_flavors (
  spice_a_id text not null, spice_b_id text not null, compound_position smallint not null,
  flavor text not null, position smallint not null check (position >= 0),
  primary key (spice_a_id, spice_b_id, compound_position, flavor),
  foreign key (spice_a_id, spice_b_id, compound_position) references public.catalog_compound_pair_shared_compounds(spice_a_id, spice_b_id, position) on delete cascade
);
create table public.catalog_compound_pair_flavordb2_words (
  spice_a_id text not null, spice_b_id text not null, word text not null, position smallint not null check (position >= 0),
  primary key (spice_a_id, spice_b_id, word),
  foreign key (spice_a_id, spice_b_id) references public.catalog_compound_pair_evidence(spice_a_id, spice_b_id) on delete cascade
);

create table public.catalog_dishes (id text primary key, source_position smallint not null unique check(source_position >= 0), name text not null, category text not null, fg_node text not null);
create index catalog_dishes_category_idx on public.catalog_dishes(category);
create table public.catalog_dish_spice_affinities (
  dish_id text not null references public.catalog_dishes(id) on delete cascade,
  spice_id text not null references public.catalog_spices(id) on delete cascade,
  score numeric not null check (score between 0 and 1),
  primary key (dish_id, spice_id)
);
create index catalog_dish_spice_affinities_spice_idx on public.catalog_dish_spice_affinities(spice_id);

create table public.catalog_aroma_fingerprints (
 spice_id text primary key references public.catalog_spices(id) on delete cascade, name text not null,
 molecule_count integer not null check(molecule_count >= 0), annotated_molecule_count integer not null check(annotated_molecule_count >= 0), mapped_molecule_count integer not null check(mapped_molecule_count >= 0),
 source_quality text not null, missing boolean not null, vector_present boolean not null default true, missing_reason text, missing_reason_present boolean not null default false
);
create table public.catalog_aroma_vector_dimensions (spice_id text not null references public.catalog_aroma_fingerprints(spice_id) on delete cascade, dimension text not null, weight numeric not null check(weight >= 0), primary key(spice_id, dimension));
create table public.catalog_aroma_descriptors (spice_id text not null references public.catalog_aroma_fingerprints(spice_id) on delete cascade, descriptor text not null, weight numeric not null check(weight >= 0), position smallint not null check(position >= 0), primary key(spice_id, position));
create table public.catalog_aroma_sources (spice_id text not null references public.catalog_aroma_fingerprints(spice_id) on delete cascade, source text not null, entity_id integer, ingredient text, quality text not null, position smallint not null check(position >= 0), primary key(spice_id, position));

create table public.catalog_cuisine_metadata (singleton boolean primary key default true check(singleton), source text not null, url text not null, license text not null, license_url text not null, retrieved text not null, method text not null, recipe_count integer not null check(recipe_count >= 0));
create table public.catalog_cuisine_input_hashes (filename text primary key, sha256 text not null);
create table public.catalog_cuisine_totals (cuisine text primary key, recipe_count integer not null check(recipe_count >= 0), position smallint not null unique check(position >= 0));
create table public.catalog_spice_cuisine_evidence (spice_id text primary key references public.catalog_spices(id) on delete cascade, name text not null, entity_id integer, entity_name text, source_quality text not null, missing boolean not null, recipe_count integer);
create table public.catalog_spice_cuisine_frequencies (spice_id text not null references public.catalog_spice_cuisine_evidence(spice_id) on delete cascade, cuisine text not null references public.catalog_cuisine_totals(cuisine) on delete restrict, recipe_count integer not null check(recipe_count >= 0), total_recipes integer not null check(total_recipes >= 0), frequency numeric not null check(frequency between 0 and 1), position smallint not null check(position >= 0), primary key(spice_id,cuisine), unique(spice_id,position));

create table public.catalog_pungency_metadata (singleton boolean primary key default true check(singleton), method text not null, sources_are text not null);
create table public.catalog_pungency_evidence (spice_id text primary key references public.catalog_spices(id) on delete cascade, name text not null, scoville_min integer check(scoville_min >= 0), scoville_max integer check(scoville_max >= scoville_min), scoville_unit text, scoville_range_present boolean not null default false, pungency_class text, pungency_class_present boolean not null default false, source_quality text not null, missing boolean not null, note text);
create table public.catalog_pungency_sources (spice_id text not null references public.catalog_pungency_evidence(spice_id) on delete cascade, url text not null, position smallint not null check(position >= 0), primary key(spice_id, position));
create table public.catalog_atlas_metadata (singleton boolean primary key default true check(singleton), method text not null, axes text[] not null, explained_variance numeric not null);

-- Every exposed catalog table has RLS. Guests may read catalog data; changes
-- require the non-user-editable app_metadata catalog_admin claim.
do $$ declare t text; begin
  foreach t in array array[
    'catalog_taxonomy_nodes','catalog_spices','catalog_spice_aliases','catalog_spice_subfamilies','catalog_spice_profile_cuisines','catalog_spice_key_compounds','catalog_spice_substitute_hints','catalog_spice_pairing_hints','catalog_spice_pairing_hint_cuisines','catalog_classic_blends','catalog_classic_blend_spices','catalog_curated_pairings','catalog_curated_pairing_entries','catalog_curated_pairing_cuisines','catalog_flavor_affinities','catalog_compound_pair_evidence','catalog_compound_pair_sources','catalog_compound_pair_shared_compounds','catalog_compound_pair_shared_flavors','catalog_compound_pair_flavordb2_words','catalog_dishes','catalog_dish_spice_affinities','catalog_aroma_fingerprints','catalog_aroma_vector_dimensions','catalog_aroma_descriptors','catalog_aroma_sources','catalog_cuisine_metadata','catalog_cuisine_input_hashes','catalog_cuisine_totals','catalog_spice_cuisine_evidence','catalog_spice_cuisine_frequencies','catalog_pungency_metadata','catalog_pungency_evidence','catalog_pungency_sources','catalog_atlas_metadata'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'Public catalog read ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using ((select coalesce(auth.jwt() -> ''app_metadata'' ->> ''catalog_admin'', ''false''))::boolean) with check ((select coalesce(auth.jwt() -> ''app_metadata'' ->> ''catalog_admin'', ''false''))::boolean)', 'Catalog administrator write ' || t, t);
  end loop;
end $$;

create or replace function public.catalog_taxonomy_node_json(node_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_strip_nulls(jsonb_build_object(
   'id', n.id, 'name', n.name, 'level', n.level, 'color', n.color, 'description', n.description,
   'children', (select jsonb_agg(public.catalog_taxonomy_node_json(c.id) order by c.position) from public.catalog_taxonomy_nodes c where c.parent_id=n.id)
 )) from public.catalog_taxonomy_nodes n where n.id=node_id;
$$;

-- A deliberately single request contract for server-side caching. It recreates
-- the legacy JSON DTOs from relational rows; it is never a JSON data store.
create or replace function public.catalog_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
 with generated_profiles as (
  select coalesce(jsonb_object_agg(s.source_key, coalesce(s.extra_metadata,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
   'id',s.slug,'name',s.name,'botanical_name',s.botanical_name,'botanical_family',s.botanical_family,'common_names',(select coalesce(jsonb_agg(a.alias order by a.position),'[]'::jsonb) from public.catalog_spice_aliases a where a.spice_id=s.id),'origin',s.origin,'description',s.description,'warmth',s.warmth,'brightness',s.brightness,'earthiness',s.earthiness,'florality',s.florality,'heat',s.heat,'family',s.family,'subfamilies',(select coalesce(jsonb_agg(x.subfamily order by x.position),'[]'::jsonb) from public.catalog_spice_subfamilies x where x.spice_id=s.id),'heat_level',s.heat_level,'intensity',s.intensity,'commonality',s.commonality,
   'cuisines',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('cuisine',x.cuisine,'frequency',x.frequency,'typical_quantity',x.typical_quantity)) order by x.position),'[]'::jsonb) from public.catalog_spice_profile_cuisines x where x.spice_id=s.id),
   'top_pairings',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('spice',x.paired_spice,'affinity',x.affinity,'note',x.note,'cuisines',case when x.cuisines_present then (select coalesce(jsonb_agg(c.cuisine order by c.position),'[]'::jsonb) from public.catalog_spice_pairing_hint_cuisines c where c.spice_id=x.spice_id and c.hint_position=x.position) else null end)) order by x.position),'[]'::jsonb) from public.catalog_spice_pairing_hints x where x.spice_id=s.id),
   'substitutes',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('spice',x.substitute,'similarity',x.similarity,'notes',x.notes)) order by x.position),'[]'::jsonb) from public.catalog_spice_substitute_hints x where x.spice_id=s.id),
   'key_compounds',(select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'role',x.role) order by x.position),'[]'::jsonb) from public.catalog_spice_key_compounds x where x.spice_id=s.id)
  )) order by s.source_position),'{}'::jsonb) data from public.catalog_spices s
 ), pairings as (
  select coalesce(jsonb_agg(jsonb_build_object('spiceId',s.spice_id,'pairsWith',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('spiceId',p.paired_spice_id,'affinity',p.affinity,'note',p.note,'cuisines',case when p.cuisines_present then (select coalesce(jsonb_agg(c.cuisine order by c.position),'[]'::jsonb) from public.catalog_curated_pairing_cuisines c where c.spice_id=p.spice_id and c.paired_spice_id=p.paired_spice_id) else null end)) order by p.source_position) from public.catalog_curated_pairings p where p.spice_id=s.spice_id),'[]'::jsonb) ) order by s.source_position),'[]'::jsonb) data from public.catalog_curated_pairing_entries s
 ), dishes as (
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'category',d.category,'fgNode',d.fg_node,'scores',coalesce((select jsonb_object_agg(x.spice_id,x.score) from public.catalog_dish_spice_affinities x where x.dish_id=d.id),'{}'::jsonb)) order by d.source_position),'[]'::jsonb) data from public.catalog_dishes d
 ), blends as (
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'origin',b.origin,'description',b.description,'spiceIds',(select coalesce(jsonb_agg(x.spice_id order by x.position),'[]'::jsonb) from public.catalog_classic_blend_spices x where x.blend_id=b.id)) order by b.source_position),'[]'::jsonb) data from public.catalog_classic_blends b
 )
 select jsonb_build_object(
  'spiceTaxonomy',public.catalog_taxonomy_node_json('root'),'generatedProfiles',generated_profiles.data,
  'profileOrder',(select coalesce(jsonb_agg(s.source_key order by s.source_position),'[]'::jsonb) from public.catalog_spices s),
  'flavorVectors',(select coalesce(jsonb_object_agg(id,jsonb_build_object('warmth',warmth,'brightness',brightness,'earthiness',earthiness,'florality',florality,'heat',heat,'intensity',intensity)),'{}'::jsonb) from public.catalog_spices),
  'flavorAtlas',(select jsonb_build_object('method',m.method,'axes',to_jsonb(m.axes),'explainedVariance',m.explained_variance,'points',(select coalesce(jsonb_object_agg(slug,jsonb_build_object('x',atlas_x,'y',atlas_y)),'{}'::jsonb) from public.catalog_spices)) from public.catalog_atlas_metadata m),
  'classicBlends',blends.data,'spicePairings',pairings.data,
  'pairingScores',(select coalesce(jsonb_agg(jsonb_build_object('a',source_a_id,'b',source_b_id,'score',score) order by source_position),'[]'::jsonb) from public.catalog_flavor_affinities),
  'compoundOverlap',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('a',e.source_a_id,'b',e.source_b_id,'sharedCount',e.shared_count,'sharedAromaCount',e.shared_aroma_count,'jaccard',e.jaccard,'shared',(select coalesce(jsonb_agg(jsonb_build_object('name',c.name,'flavors',(select coalesce(jsonb_agg(f.flavor order by f.position),'[]'::jsonb) from public.catalog_compound_pair_shared_flavors f where f.spice_a_id=c.spice_a_id and f.spice_b_id=c.spice_b_id and f.compound_position=c.position)) order by c.position),'[]'::jsonb) from public.catalog_compound_pair_shared_compounds c where c.spice_a_id=e.spice_a_id and c.spice_b_id=e.spice_b_id),'flavordb2',case when e.flavordb2_score is null then null else jsonb_build_object('score',e.flavordb2_score,'sharedCount',e.flavordb2_shared_count,'sharedFlavorWords',(select coalesce(jsonb_agg(w.word order by w.position),'[]'::jsonb) from public.catalog_compound_pair_flavordb2_words w where w.spice_a_id=e.spice_a_id and w.spice_b_id=e.spice_b_id)) end,'compoundScore',e.compound_score,'sources',(select coalesce(jsonb_agg(s.source order by s.position),'[]'::jsonb) from public.catalog_compound_pair_sources s where s.spice_a_id=e.spice_a_id and s.spice_b_id=e.spice_b_id))) order by e.source_position),'[]'::jsonb) from public.catalog_compound_pair_evidence e),
  'dishAffinities',dishes.data,
  'aromaFingerprints',(select coalesce(jsonb_object_agg(a.spice_id,jsonb_strip_nulls(jsonb_build_object('name',a.name,'vector',case when a.missing then null else (select coalesce(jsonb_object_agg(v.dimension,v.weight),'{}'::jsonb) from public.catalog_aroma_vector_dimensions v where v.spice_id=a.spice_id) end,'topDescriptors',(select coalesce(jsonb_agg(jsonb_build_object('descriptor',d.descriptor,'weight',d.weight) order by d.position),'[]'::jsonb) from public.catalog_aroma_descriptors d where d.spice_id=a.spice_id),'moleculeCount',a.molecule_count,'annotatedMoleculeCount',a.annotated_molecule_count,'mappedMoleculeCount',a.mapped_molecule_count,'sourceQuality',a.source_quality,'missing',a.missing,'sources',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('source',q.source,'entityId',q.entity_id,'ingredient',q.ingredient,'quality',q.quality)) order by q.position),'[]'::jsonb) from public.catalog_aroma_sources q where q.spice_id=a.spice_id))) || case when a.vector_present and a.missing then jsonb_build_object('vector',null::jsonb) else '{}'::jsonb end || case when a.missing_reason_present then jsonb_build_object('missingReason',a.missing_reason) else '{}'::jsonb end),'{}'::jsonb) from public.catalog_aroma_fingerprints a),
  'pungencyEvidence',(select jsonb_build_object('method',m.method,'sourcesAre',m.sources_are,'spices',coalesce((select jsonb_object_agg(e.spice_id,jsonb_strip_nulls(jsonb_build_object('name',e.name,'scovilleRange',case when e.scoville_min is null then null else jsonb_build_object('min',e.scoville_min,'max',e.scoville_max,'unit',e.scoville_unit) end,'pungencyClass',e.pungency_class,'sourceQuality',e.source_quality,'sources',(select coalesce(jsonb_agg(q.url order by q.position),'[]'::jsonb) from public.catalog_pungency_sources q where q.spice_id=e.spice_id),'missing',e.missing,'note',e.note)) || case when e.scoville_range_present and e.scoville_min is null then jsonb_build_object('scovilleRange',null::jsonb) else '{}'::jsonb end || case when e.pungency_class_present then jsonb_build_object('pungencyClass',e.pungency_class) else '{}'::jsonb end) from public.catalog_pungency_evidence e),'{}'::jsonb)) from public.catalog_pungency_metadata m),
  'cuisineFrequencies',(select jsonb_build_object('source',m.source,'url',m.url,'license',m.license,'licenseUrl',m.license_url,'retrieved',m.retrieved,'method',m.method,'inputSha256',(select coalesce(jsonb_object_agg(h.filename,h.sha256),'{}'::jsonb) from public.catalog_cuisine_input_hashes h),'recipeCount',m.recipe_count,'cuisineTotals',(select coalesce(jsonb_object_agg(t.cuisine,t.recipe_count),'{}'::jsonb) from public.catalog_cuisine_totals t),'spices',(select coalesce(jsonb_object_agg(e.spice_id,jsonb_strip_nulls(jsonb_build_object('name',e.name,'entityId',e.entity_id,'entityName',e.entity_name,'sourceQuality',e.source_quality,'missing',e.missing,'recipeCount',e.recipe_count,'cuisines',(select coalesce(jsonb_agg(jsonb_build_object('cuisine',f.cuisine,'recipeCount',f.recipe_count,'totalRecipes',f.total_recipes,'frequency',f.frequency) order by f.position),'[]'::jsonb) from public.catalog_spice_cuisine_frequencies f where f.spice_id=e.spice_id)))),'{}'::jsonb) from public.catalog_spice_cuisine_evidence e)) from public.catalog_cuisine_metadata m)
 ) from generated_profiles,pairings,dishes,blends;
$$;
revoke all on function public.catalog_taxonomy_node_json(text) from public;
grant execute on function public.catalog_taxonomy_node_json(text) to anon, authenticated, service_role;
revoke all on function public.catalog_snapshot() from public;
grant execute on function public.catalog_snapshot() to anon, authenticated, service_role;

