async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) {
    console.log("❌ Missing credentials");
    return null;
  }

  console.log("🔍 Looking up user:", credentials.email);

  const user = await db.user.findUnique({
    where: { email: credentials.email },
  });

  if (!user) {
    console.log("❌ No user found with email:", credentials.email);
    return null;
  }

  console.log("✅ User found:", user.email);

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.passwordHash
  );

  console.log("🔑 Password match:", passwordMatch);

  if (!passwordMatch) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
},