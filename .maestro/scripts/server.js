/* global ACTION, EMAIL, ID, PASSWORD, SERVER_URL, TITLE, http, json, output */
// Reads or writes the test sync server directly, as another phone would (runs on the computer that
// runs Maestro). ACTION: 'add' adds a recipe (ID, TITLE); 'read' sets output.serverRecipes to the
// server's recipes: { [title]: deleted time, 0 while it exists }.
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
  const list = http.get(`${SERVER_URL}/api/collections/recipes/records?perPage=50`, { headers });
  const recipes = {};
  for (const item of json(list.body).items) {
    recipes[item.title] = item.deleted;
  }
  output.serverRecipes = recipes;
}
