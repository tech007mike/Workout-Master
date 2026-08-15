/*
  Body Sculpt Cloud Sync
  ----------------------
  Add AFTER your existing Body Sculpt <script> and after the Supabase JS CDN.

  Required globals from the existing app:
    APP, APP_KEY, KEY_PREFIX, GRID_KEY, GROUP_SORT_MODE_KEY
    defaultAppData(), renderGroups(), closePanel(), applyGridCols(),
    getGridCols(), saveAppData()

  Replace the two placeholders below with your Supabase project values.
*/

const BODY_SCULPT_SUPABASE_URL = 'https://bfaepbmmpbnqvfkwfskh.supabase.com';
const BODY_SCULPT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__KVDIY7fTO4xkFfFriCMkA_DIPmwufd';

const bsSupabase = supabase.createClient(
  BODY_SCULPT_SUPABASE_URL,
  BODY_SCULPT_SUPABASE_PUBLISHABLE_KEY
);

const BS_CLOUD_TABLE = 'body_sculpt_profiles';
const BS_SYNC_DELAY = 900;

let bsCurrentUser = null;
let bsCloudSaveTimer = null;
let bsApplyingCloudData = false;
let bsOriginalSaveAppData = saveAppData;
let bsOriginalApplyGridCols = applyGridCols;

function bsInjectAuthUI(){
  const style = document.createElement('style');
  style.textContent = `
    #bsAuthGate{
      position:fixed;
      inset:0;
      z-index:10000;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:
        radial-gradient(900px 650px at 18% 10%, rgba(61,214,198,.13), transparent 55%),
        radial-gradient(800px 620px at 86% 18%, rgba(215,180,106,.14), transparent 52%),
        linear-gradient(180deg, #0b0f14, #0f1722);
    }
    #bsAuthGate[hidden]{ display:none !important; }

    .bs-auth-card{
      width:min(430px, 94vw);
      padding:22px;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.12);
      background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.04));
      box-shadow:0 22px 70px rgba(0,0,0,.60);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      color:rgba(255,255,255,.94);
    }
    .bs-auth-title{
      text-align:center;
      font-size:27px;
      font-weight:950;
      letter-spacing:.5px;
      margin:2px 0 4px;
    }
    .bs-auth-subtitle{
      text-align:center;
      font-size:13px;
      opacity:.76;
      line-height:1.4;
      margin-bottom:18px;
    }
    .bs-auth-card input{
      box-sizing:border-box;
      width:100%;
      margin:6px 0;
      padding:13px 14px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(12,16,22,.66);
      color:white;
      outline:none;
      font-size:15px;
    }
    .bs-auth-card input:focus{
      border-color:rgba(61,214,198,.58);
      box-shadow:0 0 0 3px rgba(61,214,198,.14);
    }
    .bs-auth-actions{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
      margin-top:10px;
    }
    .bs-auth-card button,
    #bsAccountBar button{
      border:1px solid rgba(255,255,255,.14);
      background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05));
      color:white;
      border-radius:12px;
      padding:11px 12px;
      font-weight:900;
      cursor:pointer;
    }
    .bs-auth-primary{
      border-color:rgba(61,214,198,.38) !important;
    }
    .bs-auth-status{
      min-height:18px;
      margin-top:12px;
      text-align:center;
      font-size:12px;
      line-height:1.35;
      opacity:.82;
    }
    .bs-auth-status.error{ color:#ff9aa7; opacity:1; }
    .bs-auth-status.success{ color:#a6f0e8; opacity:1; }

    #bsAccountBar{
      width:100%;
      display:flex;
      align-items:center;
      gap:9px;
      box-sizing:border-box;
      padding:10px 12px;
      border:1px solid rgba(255,255,255,.10);
      border-radius:14px;
      background:rgba(12,16,22,.42);
      box-shadow:0 10px 28px rgba(0,0,0,.30);
    }
    #bsAccountEmail{
      min-width:0;
      flex:1;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      font-size:13px;
      font-weight:850;
    }
    #bsSyncState{
      font-size:11px;
      opacity:.70;
      white-space:nowrap;
    }

    @media(max-width:500px){
      .bs-auth-actions{ grid-template-columns:1fr; }
      #bsAccountBar{ flex-wrap:wrap; }
      #bsAccountEmail{ flex-basis:55%; }
    }
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = 'bsAuthGate';
  gate.innerHTML = `
    <div class="bs-auth-card">
      <div class="bs-auth-title">Body Sculpt</div>
      <div class="bs-auth-subtitle">
        Sign in to load and save your workout profile on any device.
      </div>

      <input id="bsAuthEmail" type="email" autocomplete="email" placeholder="Email">
      <input id="bsAuthPassword" type="password" autocomplete="current-password" placeholder="Password">

      <div class="bs-auth-actions">
        <button class="bs-auth-primary" onclick="bsSignIn()">Log In</button>
        <button onclick="bsSignUp()">Create Account</button>
      </div>

      <div id="bsAuthStatus" class="bs-auth-status"></div>
    </div>
  `;
  document.body.appendChild(gate);

  const bar = document.createElement('div');
  bar.id = 'bsAccountBar';
  bar.style.display = 'none';
  bar.innerHTML = `
    <div id="bsAccountEmail"></div>
    <div id="bsSyncState">Local</div>
    <button onclick="bsSaveCloudNow()">Save Now</button>
    <button onclick="bsLogout()">Log Out</button>
  `;

  const controls = document.querySelector('.controls');
  if(controls){
    controls.parentNode.insertBefore(bar, controls);
  }else{
    document.body.insertBefore(bar, document.body.firstChild);
  }
}

function bsSetAuthStatus(message, type=''){
  const el = document.getElementById('bsAuthStatus');
  if(!el) return;
  el.textContent = message || '';
  el.className = 'bs-auth-status' + (type ? ` ${type}` : '');
}

function bsSetSyncState(message){
  const el = document.getElementById('bsSyncState');
  if(el) el.textContent = message;
}

function bsShowAppForUser(user){
  bsCurrentUser = user;
  document.getElementById('bsAuthGate').hidden = true;
  const bar = document.getElementById('bsAccountBar');
  if(bar) bar.style.display = 'flex';
  const email = document.getElementById('bsAccountEmail');
  if(email) email.textContent = user?.email || 'Signed in';
}

function bsShowLogin(){
  bsCurrentUser = null;
  document.getElementById('bsAuthGate').hidden = false;
  const bar = document.getElementById('bsAccountBar');
  if(bar) bar.style.display = 'none';
}

function bsCollectWorkouts(){
  const workouts = {};

  Object.keys(localStorage).forEach(key => {
    if(!key.startsWith(KEY_PREFIX)) return;
    if(key === APP_KEY) return;
    if(key === GRID_KEY) return;
    if(typeof GROUP_SORT_MODE_KEY !== 'undefined' && key === GROUP_SORT_MODE_KEY) return;

    const raw = localStorage.getItem(key);
    try{
      workouts[key] = JSON.parse(raw);
    }catch{
      workouts[key] = raw;
    }
  });

  return workouts;
}

function bsBuildPayload(){
  return {
    schemaVersion: 1,
    appData: APP,
    workouts: bsCollectWorkouts(),
    settings: {
      gridCols: getGridCols(),
      groupSortMode:
        typeof GROUP_SORT_MODE_KEY !== 'undefined'
          ? (localStorage.getItem(GROUP_SORT_MODE_KEY) || 'user')
          : 'user'
    },
    savedAt: new Date().toISOString()
  };
}

function bsClearBodySculptLocalData(){
  Object.keys(localStorage)
    .filter(key => key.startsWith(KEY_PREFIX))
    .forEach(key => localStorage.removeItem(key));

  localStorage.removeItem(APP_KEY);
  localStorage.removeItem(GRID_KEY);

  if(typeof GROUP_SORT_MODE_KEY !== 'undefined'){
    localStorage.removeItem(GROUP_SORT_MODE_KEY);
  }
}

function bsApplyPayload(payload){
  bsApplyingCloudData = true;

  try{
    bsClearBodySculptLocalData();

    APP = (
      payload &&
      payload.appData &&
      Array.isArray(payload.appData.groups)
    )
      ? payload.appData
      : defaultAppData();

    // Upgrade older account data using the same concepts as your existing loader.
    if(!Array.isArray(APP.setLabels) || APP.setLabels.length === 0){
      APP.setLabels = [...DEFAULT_SET_LABELS];
    }

    APP.groups.forEach(group => {
      if(!Array.isArray(group.exercises)) group.exercises = [];

      group.exercises.forEach(ex => {
        if(!Array.isArray(ex.setLabels) || ex.setLabels.length === 0){
          ex.setLabels = [...APP.setLabels];
        }

        if(!ex.percentageConfig || typeof ex.percentageConfig !== 'object'){
          ex.percentageConfig = {
            enabled:false,
            maxWeight:0,
            maxReps:0
          };
        }
      });
    });

    localStorage.setItem(APP_KEY, JSON.stringify(APP));

    const workouts = payload?.workouts || {};
    Object.entries(workouts).forEach(([key, value]) => {
      if(!key.startsWith(KEY_PREFIX)) return;
      if(key === APP_KEY || key === GRID_KEY) return;

      localStorage.setItem(
        key,
        typeof value === 'string'
          ? value
          : JSON.stringify(value ?? {})
      );
    });

    const cols = Number(payload?.settings?.gridCols);
    bsOriginalApplyGridCols([1,2,3].includes(cols) ? cols : 3);

    if(typeof GROUP_SORT_MODE_KEY !== 'undefined'){
      const sortMode = payload?.settings?.groupSortMode === 'alpha'
        ? 'alpha'
        : 'user';
      localStorage.setItem(GROUP_SORT_MODE_KEY, sortMode);
    }

    closePanel();
    renderGroups();
  }finally{
    bsApplyingCloudData = false;
  }
}

async function bsGetUser(){
  const { data, error } = await bsSupabase.auth.getUser();
  if(error) return null;
  return data?.user || null;
}

async function bsLoadUserCloudData(user){
  bsSetSyncState('Loading…');

  const { data, error } = await bsSupabase
    .from(BS_CLOUD_TABLE)
    .select('data, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if(error){
    console.error('Body Sculpt cloud load error:', error);
    bsSetSyncState('Load error');
    throw error;
  }

  if(data?.data){
    bsApplyPayload(data.data);
    bsSetSyncState('Synced');
    return;
  }

  /*
    First login for this account:
    whatever Body Sculpt data is currently in this browser becomes
    the account's initial cloud profile. This migrates existing local data.
  */
  const initialPayload = bsBuildPayload();

  const { error: insertError } = await bsSupabase
    .from(BS_CLOUD_TABLE)
    .insert({
      user_id: user.id,
      data: initialPayload,
      updated_at: new Date().toISOString()
    });

  if(insertError){
    console.error('Body Sculpt first-save error:', insertError);
    bsSetSyncState('Save error');
    throw insertError;
  }

  bsSetSyncState('Synced');
}

async function bsSaveCloudNow(){
  if(bsApplyingCloudData || !bsCurrentUser) return;

  clearTimeout(bsCloudSaveTimer);
  bsCloudSaveTimer = null;

  bsSetSyncState('Saving…');

  const payload = bsBuildPayload();

  const { error } = await bsSupabase
    .from(BS_CLOUD_TABLE)
    .upsert({
      user_id: bsCurrentUser.id,
      data: payload,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if(error){
    console.error('Body Sculpt cloud save error:', error);
    bsSetSyncState('Save error');
    return;
  }

  bsSetSyncState('Saved');
  setTimeout(()=>{
    if(bsCurrentUser) bsSetSyncState('Synced');
  }, 1200);
}

function bsScheduleCloudSave(){
  if(bsApplyingCloudData || !bsCurrentUser) return;

  clearTimeout(bsCloudSaveTimer);
  bsSetSyncState('Unsaved');

  bsCloudSaveTimer = setTimeout(()=>{
    bsSaveCloudNow();
  }, BS_SYNC_DELAY);
}

/*
  Wrap the app's existing save function.
  All current group/exercise mutations already call saveAppData(),
  so they now automatically schedule a cloud save too.
*/
saveAppData = function(data){
  bsOriginalSaveAppData(data);
  bsScheduleCloudSave();
};

/*
  Grid changes are currently saved directly to localStorage,
  so wrap this function separately.
*/
applyGridCols = function(n){
  bsOriginalApplyGridCols(n);
  bsScheduleCloudSave();
};

/*
  Workout weight/reps are also written directly to localStorage.
  One delegated input listener catches those existing chart inputs.
*/
document.addEventListener('input', (event)=>{
  if(
    event.target?.classList?.contains('rep-input') ||
    event.target?.classList?.contains('weight-input')
  ){
    bsScheduleCloudSave();
  }
});

/*
  Other existing actions can change BSCULPT localStorage keys without
  necessarily calling saveAppData afterward. This catches common click/change
  interactions and safely debounces them.
*/
document.addEventListener('change', ()=>{
  if(bsCurrentUser) bsScheduleCloudSave();
});

async function bsSignIn(){
  const email = document.getElementById('bsAuthEmail').value.trim();
  const password = document.getElementById('bsAuthPassword').value;

  if(!email || !password){
    bsSetAuthStatus('Enter your email and password.', 'error');
    return;
  }

  bsSetAuthStatus('Signing in…');

  const { data, error } = await bsSupabase.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    bsSetAuthStatus(error.message, 'error');
    return;
  }

  bsShowAppForUser(data.user);

  try{
    await bsLoadUserCloudData(data.user);
    bsSetAuthStatus('');
  }catch{
    bsSetAuthStatus('Signed in, but cloud data could not be loaded.', 'error');
  }
}

async function bsSignUp(){
  const email = document.getElementById('bsAuthEmail').value.trim();
  const password = document.getElementById('bsAuthPassword').value;

  if(!email || !password){
    bsSetAuthStatus('Enter an email and password.', 'error');
    return;
  }

  if(password.length < 6){
    bsSetAuthStatus('Use a password with at least 6 characters.', 'error');
    return;
  }

  bsSetAuthStatus('Creating account…');

  const { data, error } = await bsSupabase.auth.signUp({
    email,
    password
  });

  if(error){
    bsSetAuthStatus(error.message, 'error');
    return;
  }

  if(data?.session && data?.user){
    bsShowAppForUser(data.user);
    await bsLoadUserCloudData(data.user);
    bsSetAuthStatus('');
  }else{
    bsSetAuthStatus(
      'Account created. Check your email to confirm it, then log in.',
      'success'
    );
  }
}

async function bsLogout(){
  try{
    await bsSaveCloudNow();
  }catch{}

  await bsSupabase.auth.signOut();

  bsCurrentUser = null;
  bsClearBodySculptLocalData();

  /*
    Reloading resets all in-memory APP state. The auth gate will cover the app
    until another user signs in.
  */
  location.reload();
}

async function bsInitializeCloud(){
  bsInjectAuthUI();

  if(
    BODY_SCULPT_SUPABASE_URL.includes('YOUR_SUPABASE') ||
    BODY_SCULPT_SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE')
  ){
    bsSetAuthStatus(
      'Add your Supabase URL and publishable key in body-sculpt-cloud.js.',
      'error'
    );
    return;
  }

  const {
    data: { session }
  } = await bsSupabase.auth.getSession();

  if(session?.user){
    bsShowAppForUser(session.user);
    try{
      await bsLoadUserCloudData(session.user);
    }catch{
      bsSetAuthStatus('Could not load cloud workout data.', 'error');
    }
  }else{
    bsShowLogin();
  }

  bsSupabase.auth.onAuthStateChange((event, session)=>{
    if(event === 'SIGNED_OUT'){
      bsShowLogin();
    }
  });
}

bsInitializeCloud();
