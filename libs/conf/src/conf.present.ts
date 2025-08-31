export interface IConf {
  port: number;
  domain: string;
  defaultApiRouterPrefix: string;
  defaultUploadTmpDir: string;
  defaultUploadMaxSize: number;
  defaultLoggerPath: string;
  localesPath: string;
  fallbackLocale: string;
  defaultMongo: {
    uri: string;
    minPoolSize: number;
    maxPoolSize: number;
    connectTimeout: number;
    dbName: string;
    user: string;
    password: string;
  };
}

export const cmmConf: IConf = {
  defaultMongo: {
    uri: process.env.DEFAULT_MONGO_URI,
    dbName: process.env.DEFAULT_MONGO_DB_NAME,
    minPoolSize: Number.parseInt(process.env.DEFAULT_MONGO_MIN_POOL),
    maxPoolSize: Number.parseInt(process.env.DEFAULT_MONGO_MAX_POOL),
    connectTimeout: Number.parseInt(process.env.DEFAULT_MONGO_CONN_TIMEOUT),
    user: process.env.DEFAULT_MONGO_USER,
    password: process.env.DEFAULT_MONGO_PASS,
  },
  port: Number.parseInt(process.env.PORT),
  domain: process.env.DOMAIN,
  defaultApiRouterPrefix: process.env.DEFAULT_API_ROUTER_PREFIX,
  defaultUploadTmpDir: process.env.DEFAULT_UPLOAD_TEMP_DIR,
  defaultUploadMaxSize: Number.parseInt(process.env.DEFAULT_UPLOAD_MAX_SIZE),
  defaultLoggerPath: process.env.DEFAULT_LOGGER_PATH,
  localesPath: process.env.LOCALES_PATH,
  fallbackLocale: process.env.FALLBACK_LOCALE,
};
