export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // APS (Autodesk Platform Services) credentials for ACC integration
  APS_CLIENT_ID: process.env.APS_CLIENT_ID ?? "",
  APS_CLIENT_SECRET: process.env.APS_CLIENT_SECRET ?? "",
  // Local auth mode: bypass Manus OAuth with simple username/password
  localAuth: process.env.LOCAL_AUTH === "true",
  localUsername: process.env.LOCAL_USERNAME ?? "",
  localPassword: process.env.LOCAL_PASSWORD ?? "",
  // Multi-user mode: JSON array of {username, password, name, role} objects
  localUsers: process.env.LOCAL_USERS ?? "",
  // Sprocket URL — used by llm-usage-reporter to POST usage records centrally
  sprocketUrl: process.env.SPROCKET_URL ?? "",
  // Sprocket auth — for server-to-server calls (report generation)
  sprocketUsername: process.env.SPROCKET_USERNAME ?? "admin",
  sprocketPassword: process.env.SPROCKET_PASSWORD ?? "",
};
