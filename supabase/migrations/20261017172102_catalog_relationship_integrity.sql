-- Keep the original hint text intact while linking names that resolve to a
-- spice in this catalog. External ingredients remain valid with a NULL link.
alter table public.catalog_spice_substitute_hints
  add column resolved_spice_id text references public.catalog_spices(id) on delete set null;

alter table public.catalog_spice_pairing_hints
  add column resolved_spice_id text references public.catalog_spices(id) on delete set null;

alter table public.catalog_taxonomy_nodes
  add constraint catalog_taxonomy_nodes_not_own_parent check (parent_id is null or parent_id <> id);

-- Source orientation preserves the original JSON order; it must describe the
-- same unordered relationship as the canonical primary key.
alter table public.catalog_flavor_affinities
  add constraint catalog_flavor_affinities_source_pair check (
    least(source_a_id, source_b_id) = spice_a_id and greatest(source_a_id, source_b_id) = spice_b_id
  );
alter table public.catalog_compound_pair_evidence
  add constraint catalog_compound_pair_evidence_source_pair check (
    least(source_a_id, source_b_id) = spice_a_id and greatest(source_a_id, source_b_id) = spice_b_id
  );
create index catalog_compound_pair_evidence_b_idx on public.catalog_compound_pair_evidence(spice_b_id);

