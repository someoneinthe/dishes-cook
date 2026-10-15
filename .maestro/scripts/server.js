/* global ACTION, EMAIL, ID, PASSWORD, SERVER_URL, TITLE, http, json, output */
// Reads or writes the test sync server directly, as another phone would (runs on the computer that
// runs Maestro). ACTION: 'add' adds a recipe (ID, TITLE); 'read' and 'wait-deleted' set
// output.serverRecipes to the server's recipes: { [title]: deleted time, 0 while it exists }.
const headers = { 'Content-Type': 'application/json' };
const signIn = http.post(`${SERVER_URL}/api/collections/users/auth-with-password`, {
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  headers,
});
if (signIn.status !== 200) {
  throw new Error(`Sign-in on the test server: ${signIn.status}`);
}
headers.Authorization = json(signIn.body).token;

if (ACTION === 'add') {
  const created = http.post(`${SERVER_URL}/api/collections/recipes/records`, {
    body: JSON.stringify({
      course: 'main',
      deleted: 0,
      id: ID,
      ingredients: [],
      instructions: '',
      modified: Date.now(),
      season: 'both',
      title: TITLE,
    }),
    headers,
  });
  if (created.status !== 200) {
    throw new Error(`Recipe on the test server: ${created.status} ${created.body}`);
  }
} else {
  output.serverRecipes = readRecipes();
  // 'wait-deleted': reads again until the recipe TITLE is marked deleted, for up to 20 s.
  const deadline = Date.now() + 20_000;
  while (ACTION === 'wait-deleted' && !isDeleted(TITLE) && Date.now() < deadline) {
    pause(250);
    output.serverRecipes = readRecipes();
  }
}

function isDeleted(title) {
  return output.serverRecipes[title] > 0;
}

// Maestro's scripts have no timers: waits by checking the clock.
function pause(milliseconds) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    // waiting
  }
}

function readRecipes() {
  const list = http.get(`${SERVER_URL}/api/collections/recipes/records?perPage=50`, { headers });
  const recipes = {};
  for (const item of json(list.body).items) {
    recipes[item.title] = item.deleted;
  }
  return recipes;
}
