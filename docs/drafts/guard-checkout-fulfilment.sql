-- DRAFT ONLY. NOT A MIGRATION. DO NOT APPLY WITHOUT OWNER REVIEW.
-- Lives in docs/drafts/ on purpose so no migration runner picks it up.
--
-- Problem (read from the live function sources, 2026-10-02):
--   * public.reconcile_stripe_purchases(72), run every 15 min by money_path_tick,
--     lists EVERY paid Stripe Checkout Session of the last 72h and inserts
--     public.purchases for any that is missing, whatever its mode or product.
--     public.deliver_pending_purchases() then emails the one-time Clear to Bid
--     product to every such purchase.
--   * public.confirm_checkout_session(text) (called by biddeed-web
--     /api/checkout/confirm) does the same for the session id it is given.
--   So a paid Investor/Pro subscription ($99/mo) or a $25 SIGNAL report session
--   is turned into a Clear to Bid purchase and delivery.
--
-- Guard below: both functions skip sessions that are subscriptions
-- (mode=subscription or metadata.tier_id) or reports (metadata.mode=report or
-- metadata.product=s5_onetime). It is a DENYLIST: unmarked one-time sessions
-- still flow as before, because no producer of the Clear to Bid session has been
-- identified. OWNER DECISION: switch to an allowlist (metadata.product =
-- 'clear_to_bid') once the producer of that session is known.
--
-- Rest of each body is unchanged from the live definitions.

CREATE OR REPLACE FUNCTION public.reconcile_stripe_purchases(p_lookback_hours integer DEFAULT 72)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'biddeed', 'graphql', 'extensions', 'vault', 'cron', 'net', 'http', 'storage', 'auth'
AS $function$
declare
  v_res jsonb;
  s jsonb;
  v_since bigint;
  v_checked int := 0;
  v_missing int := 0;
  v_email text;
  v_gaps jsonb := '[]'::jsonb;
begin
  v_since := extract(epoch from (now() - make_interval(hours => p_lookback_hours)))::bigint;

  v_res := public.stripe_api(
    'GET',
    '/v1/checkout/sessions?limit=100&status=complete&created[gte]=' || v_since
  );

  if (v_res->>'status') is distinct from '200' then
    return jsonb_build_object('status','error','detail', left(v_res::text, 300));
  end if;

  for s in select * from jsonb_array_elements(v_res->'body'->'data')
  loop
    -- Only sessions where money actually moved.
    if coalesce(s->>'payment_status','') <> 'paid' then
      continue;
    end if;

    -- GUARD: subscriptions and reports are not the one-time product.
    if coalesce(s->>'mode','') = 'subscription'
       or (s->'metadata'->>'tier_id') is not null
       or coalesce(s->'metadata'->>'mode','') = 'report'
       or coalesce(s->'metadata'->>'product','') = 's5_onetime' then
      continue;
    end if;

    v_checked := v_checked + 1;

    if exists (select 1 from public.purchases p
                where p.stripe_session_id = s->>'id') then
      continue;
    end if;

    v_email := coalesce(
      s->'customer_details'->>'email',
      s->>'customer_email'
    );
    if v_email is null then
      continue;
    end if;

    insert into public.purchases (
      stripe_session_id, stripe_customer_id, stripe_payment_intent,
      email, amount_cents, currency, locale, county_hint, fulfilled_at
    ) values (
      s->>'id', s->>'customer', s->>'payment_intent', v_email,
      coalesce((s->>'amount_total')::integer,0),
      lower(coalesce(s->>'currency','usd')),
      coalesce(s->'metadata'->>'locale','en'),
      s->'metadata'->>'county',
      now()
    )
    on conflict (stripe_session_id) do nothing;

    v_missing := v_missing + 1;
    v_gaps := v_gaps || jsonb_build_object('session', s->>'id', 'email', v_email);
  end loop;

  return jsonb_build_object(
    'status','ok',
    'checked', v_checked,
    'backfilled', v_missing,
    'gaps', v_gaps
  );
end $function$;

CREATE OR REPLACE FUNCTION public.confirm_checkout_session(p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'biddeed', 'graphql', 'extensions', 'vault', 'cron', 'net', 'http', 'storage', 'auth'
AS $function$
declare
  v_resp    jsonb;
  v_sess    jsonb;
  v_email   text;
  v_pid     uuid;
  v_status  text;
begin
  if p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$' then
    return jsonb_build_object('status','error','error','malformed session id');
  end if;

  -- Already fulfilled? Answer from our own table, do not bother Stripe.
  select p.id into v_pid
    from public.purchases p
   where p.stripe_session_id = p_session_id;

  if v_pid is null then
    v_resp := public.stripe_api('GET', '/v1/checkout/sessions/' || p_session_id, null);

    if coalesce((v_resp->>'status')::int, 0) <> 200 then
      return jsonb_build_object('status','error','error','stripe lookup failed',
                                'http_status', v_resp->>'status');
    end if;

    v_sess := v_resp->'body';

    if coalesce(v_sess->>'payment_status','') <> 'paid' then
      return jsonb_build_object('status','unpaid',
                                'payment_status', v_sess->>'payment_status');
    end if;

    -- GUARD: subscriptions and reports are not the one-time product.
    if coalesce(v_sess->>'mode','') = 'subscription'
       or (v_sess->'metadata'->>'tier_id') is not null
       or coalesce(v_sess->'metadata'->>'mode','') = 'report'
       or coalesce(v_sess->'metadata'->>'product','') = 's5_onetime' then
      return jsonb_build_object('status','error','error','order type is not handled here');
    end if;

    v_email := coalesce(
      v_sess->'customer_details'->>'email',
      v_sess->>'customer_email'
    );

    if v_email is null then
      return jsonb_build_object('status','error','error','paid session carries no email');
    end if;

    insert into public.purchases (
      stripe_session_id, stripe_customer_id, stripe_payment_intent,
      email, amount_cents, currency, locale, county_hint, fulfilled_at
    ) values (
      v_sess->>'id',
      v_sess->>'customer',
      v_sess->>'payment_intent',
      v_email,
      coalesce((v_sess->>'amount_total')::integer, 0),
      lower(coalesce(v_sess->>'currency','usd')),
      coalesce(v_sess->'metadata'->>'locale','en'),
      v_sess->'metadata'->>'county',
      now()
    )
    on conflict (stripe_session_id) do nothing
    returning id into v_pid;

    -- Lost the race with the cron; pick up the row it created.
    if v_pid is null then
      select p.id into v_pid
        from public.purchases p
       where p.stripe_session_id = p_session_id;
    end if;
  end if;

  if v_pid is null then
    return jsonb_build_object('status','error','error','could not resolve purchase');
  end if;

  -- Idempotent: returns already_delivered on a refresh.
  v_status := public.deliver_purchase(v_pid)->>'status';

  select p.email into v_email from public.purchases p where p.id = v_pid;

  return jsonb_build_object(
    'status','ok',
    'delivery', v_status,
    'email', v_email,
    'purchase_id', v_pid
  );
exception when others then
  return jsonb_build_object('status','error','error', sqlerrm);
end $function$;

-- Third writer into public.purchases: the stripe_events inbox path
-- (drain_stripe_events -> fulfil_stripe_purchase). Same guard: a subscription or
-- report event is marked processed without creating a Clear to Bid purchase.
CREATE OR REPLACE FUNCTION public.fulfil_stripe_purchase(p_event_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'biddeed', 'graphql', 'extensions', 'vault', 'cron', 'net', 'http', 'storage', 'auth'
AS $function$
declare
  e record;
  obj jsonb;
  v_email text;
  v_purchase_id uuid;
  v_created boolean := false;
begin
  select * into e from public.stripe_events where event_id = p_event_id;
  if not found then
    return jsonb_build_object('status','error','error','unknown event_id');
  end if;
  if e.processed_at is not null then
    return jsonb_build_object('status','already_processed','event_id',p_event_id);
  end if;

  obj := e.payload->'data'->'object';

  -- GUARD: subscriptions and reports are not the one-time product.
  if coalesce(obj->>'mode','') = 'subscription'
     or (obj->'metadata'->>'tier_id') is not null
     or coalesce(obj->'metadata'->>'mode','') = 'report'
     or coalesce(obj->'metadata'->>'product','') = 's5_onetime' then
    update public.stripe_events
       set processed_at = now(), attempts = attempts + 1,
           process_error = 'skipped: not the one-time product'
     where event_id = p_event_id;
    return jsonb_build_object('status','skipped','reason','not the one-time product');
  end if;

  -- Stripe puts the buyer's address in different places depending on how the
  -- session was created; take the first one that is actually populated rather
  -- than assuming customer_details is always there.
  v_email := coalesce(
    obj->'customer_details'->>'email',
    obj->>'customer_email',
    obj->>'receipt_email'
  );

  if v_email is null then
    update public.stripe_events
       set attempts = attempts + 1,
           process_error = 'no email on session'
     where event_id = p_event_id;
    return jsonb_build_object('status','error','error','no email on session');
  end if;

  insert into public.purchases (
    stripe_session_id, stripe_customer_id, stripe_payment_intent,
    email, amount_cents, currency, locale, county_hint, fulfilled_at
  ) values (
    obj->>'id',
    obj->>'customer',
    obj->>'payment_intent',
    v_email,
    coalesce((obj->>'amount_total')::integer, 0),
    lower(coalesce(obj->>'currency','usd')),
    coalesce(obj->'metadata'->>'locale','en'),
    obj->'metadata'->>'county',
    now()
  )
  on conflict (stripe_session_id) do nothing
  returning id into v_purchase_id;

  v_created := v_purchase_id is not null;

  update public.stripe_events
     set processed_at = now(), attempts = attempts + 1, process_error = null
   where event_id = p_event_id;

  return jsonb_build_object(
    'status','ok',
    'created', v_created,
    'purchase_id', v_purchase_id,
    'email', v_email
  );
exception when others then
  update public.stripe_events
     set attempts = attempts + 1, process_error = sqlerrm
   where event_id = p_event_id;
  return jsonb_build_object('status','error','error',sqlerrm);
end $function$;

-- ROLLBACK PLAN: the "current definitions" are the live bodies read on
-- 2026-10-02 (this file minus the three GUARD blocks). Before applying, save
-- pg_get_functiondef() output for the three functions; rolling back is
-- re-running those saved CREATE OR REPLACE statements. No table or data
-- change, no new objects.
-- OPEN: drain_stripe_events and deliver_purchase not yet read against this
-- draft; the draft has not been run against any database.
