// Da rol admin (o mod) a un usuario que ya entró al menos una vez con Twitch.
//   npm run make-admin -- <usuario_de_twitch> [admin|mod]
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const [login, role = "admin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!login || !["admin", "mod"].includes(role)) {
  console.error("Uso: npm run make-admin -- <usuario_de_twitch> [admin|mod]");
  process.exit(1);
}
if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from("profiles")
  .update({ role })
  .eq("twitch_login", login.toLowerCase())
  .select("id, twitch_login, role");

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
if (!data?.length) {
  console.error(`No existe el usuario "${login}". Tiene que entrar una vez a la web con Twitch antes.`);
  process.exit(1);
}
console.log(`Listo: ${data[0].twitch_login} ahora es ${data[0].role}.`);
