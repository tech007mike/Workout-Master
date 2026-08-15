# Body Sculpt — GitHub Pages + Supabase accounts

This package adds multi-user login and cross-device cloud sync to the Body Sculpt
HTML app while preserving the app's existing localStorage-based UI.

## Files

- `body-sculpt-cloud.js` — authentication + per-user cloud synchronization
- `supabase-setup.sql` — database table and Row Level Security policies
- `add-to-index.html` — the two script tags to add after your existing script

## 1. Create the Supabase project

Create a Supabase project.

In the SQL Editor, run all of `supabase-setup.sql`.

In Authentication settings, configure email/password authentication the way you
want. If email confirmation is enabled, users will need to confirm their email
before their first normal sign-in.

For GitHub Pages email confirmation links, set your Supabase Auth Site URL /
allowed redirect URL to your deployed GitHub Pages URL, for example:

    https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/

## 2. Get the browser-safe project values

From Supabase project settings/API, copy:

- Project URL
- Publishable key (or browser-safe anon key for an older project)

Open `body-sculpt-cloud.js` and replace:

    YOUR_SUPABASE_PROJECT_URL
    YOUR_SUPABASE_PUBLISHABLE_KEY

Never place a service-role/secret key in this JavaScript file.

## 3. Add cloud sync to your existing HTML

Keep the Body Sculpt code you already have.

At the bottom of the HTML, after your existing large script, add:

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="./body-sculpt-cloud.js"></script>

Put `body-sculpt-cloud.js` beside `index.html` in the same GitHub repository.

## 4. Publish with GitHub Pages

A simple repository layout is:

    index.html
    body-sculpt-cloud.js

In GitHub:

1. Open the repository.
2. Settings -> Pages.
3. Deploy from a branch.
4. Choose the branch containing the files (normally `main`) and `/ (root)`.
5. Save.

## What happens to existing workout data?

On the first login for an account, if that account has no cloud row yet, the
current Body Sculpt data in that browser becomes the initial cloud profile.

That means you can open the upgraded site in the browser that already contains
your workout data, create/sign in to your account, and it will become that
account's starting data.

Afterward, if you log into the same account on another device, cloud data is
loaded into that device.

## Switching between users

Use Log Out. The script:

1. saves the current account,
2. signs it out,
3. clears Body Sculpt's local cache,
4. reloads behind the login screen.

That prevents the next person from seeing the previous person's cached workout
profile.

## Sync behavior

The existing app still writes immediately to localStorage for responsiveness.

The cloud script schedules a Supabase save shortly after:
- weight/reps edits,
- app data changes,
- grid/settings changes.

There is also a `Save Now` button in the account bar.

## Image note

Your current app converts uploaded images into base64 Data URLs and stores them
inside `APP`. This cloud layer preserves that behavior, so small images can sync,
but large/many uploads can make the JSON payload large.

A production upgrade should upload image files to Supabase Storage and store only
their URLs in `APP`.
