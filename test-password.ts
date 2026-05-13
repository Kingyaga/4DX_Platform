import bcrypt from "bcryptjs";

async function main() {
  const hash = '$2b$12$EWsrOuqvLuEPfqbTCzhDjuZ1kMFRX0sGKsQ18LK9wZqG7y9qAvYWm';
  const password = 'password123';

  const isValid = await bcrypt.compare(password, hash);
  console.log("Password valid:", isValid);

  // Also test hashing
  const newHash = bcrypt.hashSync(password, 12);
  console.log("New hash:", newHash);
  const isValid2 = await bcrypt.compare(password, newHash);
  console.log("New hash valid:", isValid2);
}

main();