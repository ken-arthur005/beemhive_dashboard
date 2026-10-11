create index customer_publication_lookup_idx on public.customer_accounts(user_id,published_revision);
create index item_assignment_pair_idx on public.nfc_items(id,current_assignment_id);
