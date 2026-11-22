# Gym database changes

`../schema.sql` is the full database for a new project. Once the gym is live, every change after that goes here as a numbered file, `001-what-it-does.sql`, written so it can run on the live database with its existing rows.

Before pasting one into the Supabase SQL Editor: fold the same change into `schema.sql`, add tests to `../test/rls.sql`, run `npm run test:db`, and have the db-guard agent review it. Never rename or drop a column the app reads.
