export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  APS_CLIENT_ID: process.env.APS_CLIENT_ID ?? "",
  APS_CLIENT_SECRET: process.env.APS_CLIENT_SECRET ?? "",
  sprocketUrl: process.env.SPROCKET_URL ?? "",
  sprocketUsername: process.env.SPROCKET_USERNAME ?? "",
  sprocketPassword: process.env.SPROCKET_PASSWORD ?? "",
  // Local auth (username/password mode — no Manus OAuth required)
  localAuth: process.env.LOCAL_AUTH === "true",
  localUsername: process.env.LOCAL_USERNAME ?? "",
  localPassword: process.env.LOCAL_PASSWORD ?? "",
  localUsers: process.env.LOCAL_USERS ?? "",
};

export const isLocalAuth = () => ENV.localAuth;
