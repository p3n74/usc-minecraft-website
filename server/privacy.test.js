import { publicAuthor, privateProfile, validateUsername } from "./privacy.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
}

const base = {
  id: "u1",
  email: "secret@example.com",
  google_display_name: "Jane Google",
  username: "jane_mc",
  hide_google_name: false,
  email_public: false,
  profile_completed: true,
};

{
  const pub = publicAuthor(base, { includeEmail: true });
  assert(!("email" in pub), "email omitted when email_public=false");
  assert(pub.displayName === "Jane Google", "shows Google name by default");
  assert(!JSON.stringify(pub).includes("secret@"), "email not in JSON");
}

{
  const hidden = publicAuthor(
    { ...base, hide_google_name: true },
    { includeEmail: true }
  );
  assert(hidden.displayName === "jane_mc", "username when hide_google_name");
  assert(!JSON.stringify(hidden).includes("Jane Google"), "Google name not leaked");
}

{
  const shown = publicAuthor(
    { ...base, email_public: true },
    { includeEmail: true }
  );
  assert(shown.email === "secret@example.com", "email when opted in");
}

{
  const noFlag = publicAuthor({ ...base, email_public: true }, { includeEmail: false });
  assert(!("email" in noFlag), "email omitted without includeEmail");
}

{
  const me = privateProfile(base);
  assert(me.email === "secret@example.com", "owner profile includes email");
  assert(me.googleDisplayName === "Jane Google", "owner sees Google name");
}

assert(validateUsername("ab") !== null, "rejects short username");
assert(validateUsername("admin") !== null, "rejects reserved");
assert(validateUsername("Cool_Player1") === null, "accepts valid username");

if (process.exitCode) {
  console.error("Privacy tests failed");
  process.exit(1);
}
console.log("All privacy tests passed");
