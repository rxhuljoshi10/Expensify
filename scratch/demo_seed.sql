-- ============================================================
-- EXPENSIFY — DEMO SEED DATA
-- User ID : ac4a1066-50dc-4fd2-963c-2726e40b77af
-- Period  : Jan 17 2026 → Apr 17 2026  (~3 months)
-- Run in  : Supabase Dashboard → SQL Editor
-- ============================================================

DO $$
DECLARE
  uid uuid := 'ac4a1066-50dc-4fd2-963c-2726e40b77af';
BEGIN

-- ── 0. Clean slate for this demo user (safe to re-run) ───────
DELETE FROM expenses          WHERE user_id = uid;
DELETE FROM recurring_expenses WHERE user_id = uid;
DELETE FROM budgets            WHERE user_id = uid;
DELETE FROM insights           WHERE user_id = uid;


-- ── 1. Monthly Budget ─────────────────────────────────────────
INSERT INTO budgets (user_id, total_budget, category_budgets)
VALUES (
  uid,
  3000000,  -- ₹30,000/month
  '{
    "Food":          800000,
    "Transport":     300000,
    "Shopping":      500000,
    "Health":        250000,
    "Entertainment": 250000,
    "Bills":         700000,
    "Fitness":       200000,
    "Personal":      150000,
    "Travel":        500000,
    "Home":          200000,
    "Education":     100000,
    "Other":         100000
  }'::jsonb
);


-- ── 2. Recurring Expenses ─────────────────────────────────────
INSERT INTO recurring_expenses (id, user_id, merchant, amount, category, frequency, next_due_date, is_active, created_at)
VALUES
  (gen_random_uuid(), uid, 'Netflix',          64900,   'Entertainment', 'monthly', '2026-05-01', true, '2026-01-15 10:00:00+00'),
  (gen_random_uuid(), uid, 'Spotify',          11900,   'Entertainment', 'monthly', '2026-05-03', true, '2026-01-15 10:00:00+00'),
  (gen_random_uuid(), uid, 'Cult Fit Gym',    149900,   'Fitness',       'monthly', '2026-05-01', true, '2026-01-15 10:00:00+00'),
  (gen_random_uuid(), uid, 'Jio Fiber',        89900,   'Bills',         'monthly', '2026-05-10', true, '2026-01-15 10:00:00+00'),
  (gen_random_uuid(), uid, 'Amazon Prime',     29900,   'Entertainment', 'monthly', '2026-05-15', true, '2026-01-15 10:00:00+00'),
  (gen_random_uuid(), uid, 'HDFC Credit Card EMI', 1200000, 'Bills',     'monthly', '2026-05-05', true, '2026-01-15 10:00:00+00');


-- ── 3. Expenses ───────────────────────────────────────────────
INSERT INTO expenses (id, user_id, amount, merchant, category, description, expense_date, created_at)
VALUES

-- ═══════════════ JANUARY 2026 (17–31) ═══════════════════════

  (gen_random_uuid(), uid,  45000, 'Swiggy',          'Food',          'Butter chicken + naan',              '2026-01-17', '2026-01-17 13:14:00+00'),
  (gen_random_uuid(), uid,  18000, 'Ola',              'Transport',     'Office commute',                     '2026-01-17', '2026-01-17 09:22:00+00'),
  (gen_random_uuid(), uid, 285000, 'DMart',            'Shopping',      'Monthly groceries',                  '2026-01-18', '2026-01-18 11:30:00+00'),
  (gen_random_uuid(), uid, 145000, 'BESCOM',           'Bills',         'Electricity bill January',           '2026-01-18', '2026-01-18 16:00:00+00'),
  (gen_random_uuid(), uid,  52000, 'Starbucks',        'Food',          'Cappuccino + sandwich',              '2026-01-19', '2026-01-19 10:45:00+00'),
  (gen_random_uuid(), uid,  22000, 'Uber',             'Transport',     'To airport drop',                    '2026-01-20', '2026-01-20 07:10:00+00'),
  (gen_random_uuid(), uid,  38000, 'Apollo Pharmacy',  'Health',        'Medicines',                          '2026-01-20', '2026-01-20 19:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Zomato',           'Food',          'Biryani for dinner',                 '2026-01-21', '2026-01-21 20:30:00+00'),
  (gen_random_uuid(), uid,  60000, 'PVR Cinemas',      'Entertainment', 'Movie tickets (2)',                  '2026-01-21', '2026-01-21 18:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'HP Petrol Pump',   'Transport',     'Petrol refill',                      '2026-01-22', '2026-01-22 08:30:00+00'),
  (gen_random_uuid(), uid,  29000, 'Uber',             'Transport',     'Evening ride',                       '2026-01-23', '2026-01-23 19:40:00+00'),
  (gen_random_uuid(), uid, 120000, 'Blinkit',          'Shopping',      'Snacks + household items',           '2026-01-23', '2026-01-23 21:00:00+00'),
  (gen_random_uuid(), uid,  52000, 'Swiggy',           'Food',          'Pizza night',                        '2026-01-24', '2026-01-24 20:45:00+00'),
  (gen_random_uuid(), uid, 129900, 'Amazon',           'Shopping',      'Boat earphones',                     '2026-01-25', '2026-01-25 14:00:00+00'),
  (gen_random_uuid(), uid,  35000, 'Zomato',           'Food',          'Lunch wraps',                        '2026-01-25', '2026-01-25 13:15:00+00'),
  (gen_random_uuid(), uid,  34000, 'Uber',             'Transport',     'Weekend outing',                     '2026-01-27', '2026-01-27 14:20:00+00'),
  (gen_random_uuid(), uid,  68000, 'Barbeque Nation',  'Food',          'Dinner with friends',                '2026-01-27', '2026-01-27 20:00:00+00'),
  (gen_random_uuid(), uid, 249900, 'Flipkart',         'Shopping',      'Nike running shoes',                 '2026-01-28', '2026-01-28 12:00:00+00'),
  (gen_random_uuid(), uid,  28000, 'Cafe Coffee Day',  'Food',          'Coffee + pastry',                    '2026-01-28', '2026-01-28 17:30:00+00'),
  (gen_random_uuid(), uid,  49000, 'Swiggy',           'Food',          'Dinner',                             '2026-01-29', '2026-01-29 21:00:00+00'),
  (gen_random_uuid(), uid,   8000, 'BMTC / Namma Metro','Transport',    'Metro card recharge',                '2026-01-29', '2026-01-29 08:00:00+00'),
  (gen_random_uuid(), uid,  50000, 'Manipal Hospital', 'Health',        'General consultation',               '2026-01-30', '2026-01-30 11:00:00+00'),
  (gen_random_uuid(), uid,  64000, 'MedPlus',          'Health',        'Prescription medicines',             '2026-01-30', '2026-01-30 12:00:00+00'),
  (gen_random_uuid(), uid, 320000, 'Zudio',            'Shopping',      'New clothes haul',                   '2026-01-31', '2026-01-31 15:00:00+00'),
  (gen_random_uuid(), uid, 120000, 'Social',           'Food',          'End of month dinner',                '2026-01-31', '2026-01-31 21:00:00+00'),

-- ═══════════════ FEBRUARY 2026 ═══════════════════════════════

  (gen_random_uuid(), uid,  42000, 'Zomato',           'Food',          'Sunday brunch',                      '2026-02-01', '2026-02-01 11:30:00+00'),
  (gen_random_uuid(), uid,  64900, 'Netflix',          'Entertainment', 'Monthly subscription',               '2026-02-01', '2026-02-01 08:00:00+00'),
  (gen_random_uuid(), uid, 149900, 'Cult Fit',         'Fitness',       'Monthly gym membership',             '2026-02-01', '2026-02-01 08:00:00+00'),
  (gen_random_uuid(), uid,  25000, 'Uber',             'Transport',     'Office commute',                     '2026-02-03', '2026-02-03 09:15:00+00'),
  (gen_random_uuid(), uid,  11900, 'Spotify',          'Entertainment', 'Premium subscription',               '2026-02-03', '2026-02-03 08:00:00+00'),
  (gen_random_uuid(), uid, 320000, 'BigBasket',        'Shopping',      'Monthly grocery order',              '2026-02-04', '2026-02-04 10:00:00+00'),
  (gen_random_uuid(), uid,  18000, 'Ola',              'Transport',     'Commute to work',                    '2026-02-05', '2026-02-05 09:05:00+00'),
  (gen_random_uuid(), uid,  38000, 'Swiggy',           'Food',          'Lunch',                              '2026-02-05', '2026-02-05 13:00:00+00'),
  (gen_random_uuid(), uid,  89900, 'Jio',              'Bills',         'Fiber broadband monthly',            '2026-02-06', '2026-02-06 10:00:00+00'),
  (gen_random_uuid(), uid,  59900, 'Amazon',           'Education',     'JavaScript book',                    '2026-02-07', '2026-02-07 14:00:00+00'),
  (gen_random_uuid(), uid,  56000, 'Zomato',           'Food',          'Pasta dinner',                       '2026-02-07', '2026-02-07 20:30:00+00'),
  (gen_random_uuid(), uid,  45000, 'INOX',             'Entertainment', 'Movie night',                        '2026-02-08', '2026-02-08 18:00:00+00'),
  (gen_random_uuid(), uid,  28000, 'Swiggy',           'Food',          'Snacks',                             '2026-02-08', '2026-02-08 19:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'Indian Oil',       'Transport',     'Petrol',                             '2026-02-09', '2026-02-09 08:20:00+00'),
  (gen_random_uuid(), uid,  49000, 'Swiggy',           'Food',          'Dinner',                             '2026-02-10', '2026-02-10 21:00:00+00'),
  (gen_random_uuid(), uid, 179900, 'Amazon',           'Shopping',      'Wireless keyboard',                  '2026-02-11', '2026-02-11 13:00:00+00'),
  (gen_random_uuid(), uid, 280000, 'The Black Pearl',  'Food',          'Valentine week dinner',              '2026-02-12', '2026-02-12 20:30:00+00'),
  (gen_random_uuid(), uid,  32000, 'Uber',             'Transport',     'Evening ride',                       '2026-02-13', '2026-02-13 19:30:00+00'),
  (gen_random_uuid(), uid,  85000, 'FNP',              'Personal',      "Valentine's flowers & chocolates",   '2026-02-14', '2026-02-14 10:00:00+00'),
  (gen_random_uuid(), uid, 320000, 'Farzi Cafe',       'Food',          "Valentine's Day dinner",             '2026-02-14', '2026-02-14 20:00:00+00'),
  (gen_random_uuid(), uid,  42000, 'Third Wave Coffee', 'Food',         'Coffee date',                        '2026-02-15', '2026-02-15 11:00:00+00'),
  (gen_random_uuid(), uid,  12000, 'Namma Metro',      'Transport',     'Metro rides',                        '2026-02-16', '2026-02-16 09:00:00+00'),
  (gen_random_uuid(), uid,  89000, 'Blinkit',          'Shopping',      'Household essentials',               '2026-02-17', '2026-02-17 20:00:00+00'),
  (gen_random_uuid(), uid,  60000, 'Manipal Hospital', 'Health',        'Follow up consultation',             '2026-02-18', '2026-02-18 11:00:00+00'),
  (gen_random_uuid(), uid, 120000, 'Thyrocare',        'Health',        'Full body health checkup',           '2026-02-18', '2026-02-18 08:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Apollo Pharmacy',  'Health',        'Vitamins & supplements',             '2026-02-19', '2026-02-19 12:00:00+00'),
  (gen_random_uuid(), uid,  45000, 'Swiggy',           'Food',          'Friday dinner',                      '2026-02-20', '2026-02-20 21:00:00+00'),
  (gen_random_uuid(), uid,  28000, 'Uber',             'Transport',     'Commute',                            '2026-02-21', '2026-02-21 09:10:00+00'),
  (gen_random_uuid(), uid,  35000, 'Naturals Salon',   'Personal',      'Monthly haircut',                    '2026-02-21', '2026-02-21 14:00:00+00'),
  (gen_random_uuid(), uid,  52000, 'Zomato',           'Food',          'Saturday lunch',                     '2026-02-22', '2026-02-22 13:00:00+00'),
  (gen_random_uuid(), uid,  29900, 'Amazon Prime',     'Entertainment', 'Monthly subscription',               '2026-02-23', '2026-02-23 08:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'HP Petrol Pump',   'Transport',     'Petrol refill',                      '2026-02-24', '2026-02-24 08:30:00+00'),
  (gen_random_uuid(), uid, 210000, 'BigBasket',        'Shopping',      'Grocery restock',                    '2026-02-25', '2026-02-25 10:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Swiggy',           'Food',          'Dinner',                             '2026-02-25', '2026-02-25 20:30:00+00'),
  (gen_random_uuid(), uid,  22000, 'Ola',              'Transport',     'To mall',                            '2026-02-26', '2026-02-26 14:20:00+00'),
  (gen_random_uuid(), uid, 110000, 'The Fatty Bao',    'Food',          'Dinner with colleagues',             '2026-02-27', '2026-02-27 21:00:00+00'),
  (gen_random_uuid(), uid, 160000, 'BESCOM',           'Bills',         'Electricity bill February',          '2026-02-28', '2026-02-28 16:00:00+00'),
  (gen_random_uuid(), uid,  29900, 'Udemy',            'Education',     'React Native course',                '2026-02-28', '2026-02-28 11:00:00+00'),

-- ═══════════════ MARCH 2026 ══════════════════════════════════

  (gen_random_uuid(), uid,  64900, 'Netflix',          'Entertainment', 'Monthly subscription',               '2026-03-01', '2026-03-01 08:00:00+00'),
  (gen_random_uuid(), uid, 149900, 'Cult Fit',         'Fitness',       'Monthly gym membership',             '2026-03-01', '2026-03-01 08:00:00+00'),
  (gen_random_uuid(), uid,  46000, 'Zomato',           'Food',          'Sunday special',                     '2026-03-02', '2026-03-02 13:00:00+00'),
  (gen_random_uuid(), uid,  11900, 'Spotify',          'Entertainment', 'Monthly subscription',               '2026-03-03', '2026-03-03 08:00:00+00'),
  (gen_random_uuid(), uid,  26000, 'Uber',             'Transport',     'Office commute',                     '2026-03-03', '2026-03-03 09:15:00+00'),
  (gen_random_uuid(), uid, 260000, 'DMart',            'Shopping',      'Monthly groceries',                  '2026-03-04', '2026-03-04 11:00:00+00'),
  (gen_random_uuid(), uid,  42000, 'Swiggy',           'Food',          'Lunch',                              '2026-03-05', '2026-03-05 13:15:00+00'),
  (gen_random_uuid(), uid,  89900, 'Jio',              'Bills',         'Fiber broadband monthly',            '2026-03-06', '2026-03-06 10:00:00+00'),
  (gen_random_uuid(), uid,  19000, 'Ola',              'Transport',     'Commute',                            '2026-03-07', '2026-03-07 09:05:00+00'),
  (gen_random_uuid(), uid, 150000, 'Holi celebration', 'Food',          'Holi party food & drinks',           '2026-03-08', '2026-03-08 14:00:00+00'),
  (gen_random_uuid(), uid, 249900, 'Amazon',           'Shopping',      'Smart watch',                        '2026-03-09', '2026-03-09 15:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Swiggy',           'Food',          'Dinner',                             '2026-03-10', '2026-03-10 20:30:00+00'),
  (gen_random_uuid(), uid,  50000, 'PVR',              'Entertainment', 'Movie (2 tickets)',                   '2026-03-11', '2026-03-11 18:30:00+00'),
  (gen_random_uuid(), uid, 150000, 'BPCL Petrol Pump', 'Transport',     'Petrol refill',                      '2026-03-12', '2026-03-12 08:20:00+00'),
  (gen_random_uuid(), uid,  49000, 'Zomato',           'Food',          'Evening snacks',                     '2026-03-13', '2026-03-13 18:45:00+00'),
  (gen_random_uuid(), uid,  31000, 'Uber',             'Transport',     'Night ride',                         '2026-03-14', '2026-03-14 22:30:00+00'),
  (gen_random_uuid(), uid,  80000, 'YLG Salon',        'Personal',      'Hair spa + styling',                 '2026-03-15', '2026-03-15 12:00:00+00'),
  (gen_random_uuid(), uid, 349900, 'Myntra',           'Shopping',      'Spring wardrobe refresh',            '2026-03-15', '2026-03-15 16:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Blue Tokai Coffee','Food',          'Coffee + work session',              '2026-03-16', '2026-03-16 10:30:00+00'),
  (gen_random_uuid(), uid,  28000, 'MedPlus',          'Health',        'Medicines',                          '2026-03-17', '2026-03-17 12:00:00+00'),
  (gen_random_uuid(), uid,  52000, 'Swiggy',           'Food',          'Dinner',                             '2026-03-18', '2026-03-18 21:00:00+00'),
  (gen_random_uuid(), uid,  10000, 'Namma Metro',      'Transport',     'Metro card top up',                  '2026-03-19', '2026-03-19 09:00:00+00'),
  (gen_random_uuid(), uid, 140000, 'Punjabi Dhaba',    'Food',          'Big family dinner',                  '2026-03-20', '2026-03-20 20:30:00+00'),
  (gen_random_uuid(), uid, 110000, 'Blinkit',          'Shopping',      'Household essentials',               '2026-03-21', '2026-03-21 19:00:00+00'),
  (gen_random_uuid(), uid,  69900, 'Amazon',           'Shopping',      'Phone case + accessories',           '2026-03-22', '2026-03-22 13:00:00+00'),
  (gen_random_uuid(), uid,  45000, 'Swiggy',           'Food',          'Sunday lunch',                       '2026-03-23', '2026-03-23 13:00:00+00'),
  (gen_random_uuid(), uid,  34000, 'Uber',             'Transport',     'Bangalore traffic ride',             '2026-03-24', '2026-03-24 18:30:00+00'),
  (gen_random_uuid(), uid,  50000, 'Fortis Hospital',  'Health',        'Dermatologist visit',                '2026-03-25', '2026-03-25 11:00:00+00'),
  (gen_random_uuid(), uid,  42000, 'Zomato',           'Food',          'Wednesday dinner',                   '2026-03-26', '2026-03-26 21:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'Indian Oil',       'Transport',     'Full tank petrol',                   '2026-03-27', '2026-03-27 08:00:00+00'),
  (gen_random_uuid(), uid, 850000, 'Indigo Airlines',  'Travel',        'BLR to GOA flight (return)',         '2026-03-28', '2026-03-28 06:00:00+00'),
  (gen_random_uuid(), uid,  58000, 'Swiggy',           'Food',          'Airport meal',                       '2026-03-28', '2026-03-28 10:00:00+00'),
  (gen_random_uuid(), uid, 550000, 'Taj Holiday Inn',  'Travel',        'Goa hotel (2 nights)',               '2026-03-29', '2026-03-29 14:00:00+00'),
  (gen_random_uuid(), uid, 120000, 'Fisherman\'s Wharf','Food',         'Goa seafood dinner',                 '2026-03-29', '2026-03-29 20:30:00+00'),
  (gen_random_uuid(), uid, 180000, 'Goa Taxi',         'Travel',        'Sightseeing cab',                    '2026-03-30', '2026-03-30 10:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'Souvenirs & Beach','Shopping',      'Goa shopping',                       '2026-03-30', '2026-03-30 16:00:00+00'),
  (gen_random_uuid(), uid,  75000, 'Britto\'s',        'Food',          'Goa beach shack lunch',              '2026-03-30', '2026-03-30 13:00:00+00'),
  (gen_random_uuid(), uid, 750000, 'Indigo Airlines',  'Travel',        'GOA to BLR return flight',           '2026-03-31', '2026-03-31 15:00:00+00'),
  (gen_random_uuid(), uid, 135000, 'BESCOM',           'Bills',         'Electricity bill March',             '2026-03-31', '2026-03-31 16:00:00+00'),

-- ═══════════════ APRIL 2026 (1–17) ═══════════════════════════

  (gen_random_uuid(), uid,  64900, 'Netflix',          'Entertainment', 'Monthly subscription',               '2026-04-01', '2026-04-01 08:00:00+00'),
  (gen_random_uuid(), uid, 149900, 'Cult Fit',         'Fitness',       'Monthly gym membership',             '2026-04-01', '2026-04-01 08:00:00+00'),
  (gen_random_uuid(), uid,  48000, 'Zomato',           'Food',          'Post-trip craving',                  '2026-04-02', '2026-04-02 13:00:00+00'),
  (gen_random_uuid(), uid,  11900, 'Spotify',          'Entertainment', 'Monthly subscription',               '2026-04-03', '2026-04-03 08:00:00+00'),
  (gen_random_uuid(), uid,  27000, 'Uber',             'Transport',     'Office commute',                     '2026-04-03', '2026-04-03 09:10:00+00'),
  (gen_random_uuid(), uid, 280000, 'DMart',            'Shopping',      'Monthly grocery haul',               '2026-04-04', '2026-04-04 11:00:00+00'),
  (gen_random_uuid(), uid,  42000, 'Swiggy',           'Food',          'Saturday lunch',                     '2026-04-05', '2026-04-05 13:15:00+00'),
  (gen_random_uuid(), uid,  89900, 'Jio',              'Bills',         'Fiber broadband monthly',            '2026-04-06', '2026-04-06 10:00:00+00'),
  (gen_random_uuid(), uid, 129900, 'Amazon',           'Shopping',      'HDMI cable + hub',                   '2026-04-07', '2026-04-07 12:00:00+00'),
  (gen_random_uuid(), uid,  20000, 'Ola',              'Transport',     'Evening commute',                    '2026-04-07', '2026-04-07 18:30:00+00'),
  (gen_random_uuid(), uid,  49000, 'Swiggy',           'Food',          'Dinner',                             '2026-04-08', '2026-04-08 21:00:00+00'),
  (gen_random_uuid(), uid,  55000, 'INOX',             'Entertainment', 'New Bollywood release',              '2026-04-09', '2026-04-09 18:00:00+00'),
  (gen_random_uuid(), uid, 160000, 'Toit Brewpub',     'Food',          'Dinner with team',                   '2026-04-10', '2026-04-10 21:00:00+00'),
  (gen_random_uuid(), uid, 150000, 'HP Petrol Pump',   'Transport',     'Full tank',                          '2026-04-10', '2026-04-10 08:20:00+00'),
  (gen_random_uuid(), uid,  29000, 'Uber',             'Transport',     'Night ride home',                    '2026-04-11', '2026-04-11 23:00:00+00'),
  (gen_random_uuid(), uid,  52000, 'Zomato',           'Food',          'Weekend lunch',                      '2026-04-12', '2026-04-12 13:30:00+00'),
  (gen_random_uuid(), uid,  98000, 'Blinkit',          'Shopping',      'Weekly essentials',                  '2026-04-13', '2026-04-13 19:00:00+00'),
  (gen_random_uuid(), uid,  38000, 'Blue Tokai',       'Food',          'Coffee + brunch',                    '2026-04-14', '2026-04-14 10:30:00+00'),
  (gen_random_uuid(), uid,  12000, 'Namma Metro',      'Transport',     'Metro top-up',                       '2026-04-15', '2026-04-15 08:45:00+00'),
  (gen_random_uuid(), uid,  45000, 'Apollo Pharmacy',  'Health',        'Allergy medicines',                  '2026-04-15', '2026-04-15 12:30:00+00'),
  (gen_random_uuid(), uid,  46000, 'Swiggy',           'Food',          'Dinner',                             '2026-04-16', '2026-04-16 20:45:00+00'),
  (gen_random_uuid(), uid, 189900, 'Amazon',           'Shopping',      'Noisecancelling headphones',         '2026-04-16', '2026-04-16 14:00:00+00'),
  (gen_random_uuid(), uid, 110000, 'Hard Rock Cafe',   'Food',          'Team outing lunch',                  '2026-04-17', '2026-04-17 13:30:00+00'),
  (gen_random_uuid(), uid,  24000, 'Uber',             'Transport',     'To office',                          '2026-04-17', '2026-04-17 09:00:00+00');


-- ── 4. AI Insights ────────────────────────────────────────────
INSERT INTO insights (id, user_id, type, content, generated_at)
VALUES
  (
    gen_random_uuid(), uid,
    'monthly_summary',
    'In January, you spent ₹12,840 in total. Your top spending category was Shopping (₹9,780), followed by Food (₹8,230). You had 3 health-related expenses this month — a good sign you are investing in yourself. Consider setting a shopping budget to avoid impulse buys.',
    '2026-02-01 09:00:00+00'
  ),
  (
    gen_random_uuid(), uid,
    'monthly_summary',
    'February was your most expensive month for Food — ₹14,560 spent, largely driven by the Valentine''s week outings (₹6,000+ in 3 days). On the bright side, your transport spending stayed controlled at ₹3,220. Health expenses were ₹2,180 — remember to claim these on your insurance.',
    '2026-03-01 09:00:00+00'
  ),
  (
    gen_random_uuid(), uid,
    'monthly_summary',
    'March was your biggest month — ₹38,200 total, mostly due to the Goa trip (₹23,300 on travel alone). Excluding travel, your core spending was ₹14,900, which is well within your ₹30,000 monthly budget. Great job planning ahead for the trip!',
    '2026-04-01 09:00:00+00'
  ),
  (
    gen_random_uuid(), uid,
    'weekly_summary',
    'This week (Apr 14–17) you have spent ₹4,660. Largest single expense: Amazon headphones ₹1,899. Food is tracking at ₹1,540 so far this week. You''re on track to stay within budget this month.',
    '2026-04-17 08:00:00+00'
  ),
  (
    gen_random_uuid(), uid,
    'daily_summary',
    'Yesterday (Apr 16) you spent ₹2,359 across 2 transactions — Swiggy ₹460 and Amazon ₹1,899. Your daily spend average this month is ₹1,821. A splurge on gadgets today, but overall April looks healthy.',
    '2026-04-17 07:00:00+00'
  );

RAISE NOTICE 'Demo seed complete for user %', uid;
END $$;
