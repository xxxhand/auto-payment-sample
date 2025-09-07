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
  ecpay: {
    merchantID: string;
    hashKey: string;
    hashIV: string;
    isTestMode: boolean;
    returnURL: string;
    clientBackURL?: string;
    orderResultURL?: string;
    apiEndpoints: {
      aio: string;
      query: string;
    };
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
  ecpay: {
    merchantID: process.env.ECPAY_MERCHANT_ID || (process.env.NODE_ENV !== 'production' ? '2000132' : ''),
    hashKey: process.env.ECPAY_HASH_KEY || (process.env.NODE_ENV !== 'production' ? '5294y06JbISpM5x9' : ''),
    hashIV: process.env.ECPAY_HASH_IV || (process.env.NODE_ENV !== 'production' ? 'v77hoKGq4kWxNNIS' : ''),
    isTestMode: process.env.NODE_ENV !== 'production',
    returnURL: process.env.ECPAY_RETURN_URL || 'https://your-domain.com/api/webhooks/ecpay',
    clientBackURL: process.env.ECPAY_CLIENT_BACK_URL,
    orderResultURL: process.env.ECPAY_ORDER_RESULT_URL,
    apiEndpoints: {
      aio: process.env.NODE_ENV !== 'production' ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5' : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
      query: process.env.NODE_ENV !== 'production' ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5' : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
    },
  },
};
