export const ENV = {
  appId: process.env.VITE_APP_ID ?? "medisupply-local",
  cookieSecret: process.env.JWT_SECRET ?? "medisupply-dev-secret-change-in-production-32ch",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

if (!process.env.JWT_SECRET) {
  console.warn("[ENV] JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env for production.");
}
